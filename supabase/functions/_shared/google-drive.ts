/**
 * Google Drive API v3 Client Helpers for Supabase Edge Functions.
 * Restricted to https://www.googleapis.com/auth/drive.file scope.
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface DriveFileResult {
  id: string;
  name: string;
  webViewLink?: string;
}

/** Refresh access token using offline refresh_token */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET edge function secrets");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.error === "invalid_grant") {
      throw new Error("REVOKED: Google Drive access was revoked or expired");
    }
    throw new Error(`Failed to refresh Google token: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

/** Find or create a folder by name inside a parent folder */
export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Failed searching for folder "${folderName}": ${err}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed creating folder "${folderName}": ${err}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Builds the folder structure:
 * FaceAttendance Backups / {Reports | Attendance} / YYYY / MM
 */
export async function resolveTargetFolder(
  accessToken: string,
  fileType: "report" | "attendance",
  savedRootFolderId?: string | null,
  date: Date = new Date()
): Promise<{ rootFolderId: string; targetFolderId: string }> {
  // 1. Root folder: FaceAttendance Backups
  let rootFolderId = savedRootFolderId;
  if (!rootFolderId) {
    rootFolderId = await getOrCreateFolder(accessToken, "FaceAttendance Backups");
  }

  // 2. Subfolder: Reports or Attendance
  const subCategory = fileType === "report" ? "Reports" : "Attendance";
  const categoryFolderId = await getOrCreateFolder(accessToken, subCategory, rootFolderId);

  // 3. Year: YYYY
  const yearStr = String(date.getFullYear());
  const yearFolderId = await getOrCreateFolder(accessToken, yearStr, categoryFolderId);

  // 4. Month: MM
  const monthStr = String(date.getMonth() + 1).padStart(2, "0");
  const monthFolderId = await getOrCreateFolder(accessToken, monthStr, yearFolderId);

  return { rootFolderId, targetFolderId: monthFolderId };
}

/** Check if a file with the given name already exists in target folder */
export async function findExistingFile(
  accessToken: string,
  fileName: string,
  folderId: string
): Promise<{ id: string; webViewLink?: string } | null> {
  const query = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink)&spaces=drive`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Uploads or updates a PDF file in Google Drive.
 * Uses Resumable upload for files > 5MB, and standard multipart for smaller files.
 * Retries up to 3 times on transient failures.
 */
export async function uploadPdfWithRetry(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null
): Promise<DriveFileResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (pdfBytes.length > 5 * 1024 * 1024) {
        return await uploadResumable(accessToken, targetFolderId, fileName, pdfBytes, existingFileId);
      } else {
        return await uploadMultipart(accessToken, targetFolderId, fileName, pdfBytes, existingFileId);
      }
    } catch (err: any) {
      lastError = err;
      if (attempt < 3) {
        // Exponential backoff: 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError || new Error("Upload failed after 3 attempts");
}

/** Multipart upload for smaller files <= 5MB */
async function uploadMultipart(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null
): Promise<DriveFileResult> {
  const isUpdate = !!existingFileId;
  const boundary = `-------314159265358979323846`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: "application/pdf",
  };
  if (!isUpdate) {
    metadata.parents = [targetFolderId];
  }

  const endpoint = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`;

  const method = isUpdate ? "PATCH" : "POST";

  const enc = new TextEncoder();
  const header = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}${delimiter}Content-Type: application/pdf\r\n\r\n`;

  const headerBytes = enc.encode(header);
  const footerBytes = enc.encode(closeDelimiter);

  const totalLength = headerBytes.length + pdfBytes.length + footerBytes.length;
  const body = new Uint8Array(totalLength);
  body.set(headerBytes, 0);
  body.set(pdfBytes, headerBytes.length);
  body.set(footerBytes, headerBytes.length + pdfBytes.length);

  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(totalLength),
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive multipart upload failed: ${err}`);
  }

  return await res.json();
}

/** Resumable upload for files > 5MB */
async function uploadResumable(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null
): Promise<DriveFileResult> {
  const isUpdate = !!existingFileId;
  const initUrl = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink`;

  const method = isUpdate ? "PATCH" : "POST";

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: "application/pdf",
  };
  if (!isUpdate) {
    metadata.parents = [targetFolderId];
  }

  // 1. Initiate resumable upload session
  const initRes = await fetch(initUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/pdf",
      "X-Upload-Content-Length": String(pdfBytes.length),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Failed initiating resumable upload: ${err}`);
  }

  const uploadLocation = initRes.headers.get("Location");
  if (!uploadLocation) {
    throw new Error("No Location header returned for resumable upload");
  }

  // 2. Upload byte payload
  const uploadRes = await fetch(uploadLocation, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBytes.length),
    },
    body: pdfBytes,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Resumable upload body transfer failed: ${err}`);
  }

  return await uploadRes.json();
}
