import { createClient } from "@supabase/supabase-js";

function getEnv(key: string, env?: unknown): string {
  if (env && typeof env === "object" && key in env) {
    const val = (env as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return process.env[key] || "";
}

async function getCredentials(env?: unknown) {
  let clientId =
    getEnv("GOOGLE_CLIENT_ID", env) ||
    getEnv("VITE_GOOGLE_CLIENT_ID", env) ||
    "";
  let clientSecret = getEnv("GOOGLE_CLIENT_SECRET", env) || "";

  const supabaseUrl =
    getEnv("SUPABASE_URL", env) ||
    getEnv("VITE_SUPABASE_URL", env) ||
    "https://mnnecoyqofhrivxufhqm.supabase.co";

  const serviceRoleKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY", env) ||
    getEnv("SUPABASE_SECRET_KEY", env) ||
    "";

  if ((!clientId || !clientSecret) && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase
        .from("system_secrets")
        .select("name, value")
        .in("name", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);

      for (const row of data ?? []) {
        if (row.name === "GOOGLE_CLIENT_ID" && !clientId) clientId = row.value;
        if (row.name === "GOOGLE_CLIENT_SECRET" && !clientSecret) clientSecret = row.value;
      }
    } catch (err) {
      console.warn("Failed fetching credentials from system_secrets:", err);
    }
  }

  return { clientId, clientSecret, supabaseUrl, serviceRoleKey };
}

async function getEncryptionKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(secret || "face-attendance-drive-secret-fallback-key-32b");
  const hash = await crypto.subtle.digest("SHA-256", rawKey);

  return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plainText: string, secret: string): Promise<string> {
  const key = await getEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encoded = enc.encode(plainText);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${ctB64}`;
}

export async function decryptToken(
  encryptedString: string,
  secret: string,
  env?: unknown,
): Promise<string> {
  const [ivB64, ctB64] = encryptedString.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const candidates = [
    secret,
    "face-attendance-drive-secret-fallback-key-32b",
    getEnv("DRIVE_ENCRYPTION_KEY", env),
    getEnv("SUPABASE_SERVICE_ROLE_KEY", env),
    getEnv("SUPABASE_SECRET_KEY", env),
  ].filter(Boolean);

  let lastError: unknown;
  for (const cand of candidates) {
    try {
      const key = await getEncryptionKey(cand);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to decrypt token with secret key");
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
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

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new Error("REVOKED: Google Drive access was revoked or expired. Please reconnect Google Drive.");
    }
    throw new Error(`Failed to refresh Google token: ${data.error_description || data.error || res.statusText}`);
  }

  return data.access_token;
}

export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
): Promise<string> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query,
  )}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0]!.id;
    }
  }

  // Create folder
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    metadata["parents"] = [parentFolderId];
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

  const folderData = (await createRes.json()) as { id: string };
  return folderData.id;
}

export async function resolveTargetFolder(
  accessToken: string,
  fileType: "attendance" | "report",
  savedRootFolderId?: string | null,
  date: Date = new Date(),
): Promise<{ rootFolderId: string; targetFolderId: string }> {
  let rootFolderId = savedRootFolderId;
  if (!rootFolderId) {
    rootFolderId = await getOrCreateFolder(accessToken, "FaceAttendance Backups");
  }

  const subCategory = fileType === "report" ? "Reports" : "Attendance";
  const categoryFolderId = await getOrCreateFolder(accessToken, subCategory, rootFolderId);

  const yearStr = String(date.getFullYear());
  const yearFolderId = await getOrCreateFolder(accessToken, yearStr, categoryFolderId);

  const monthStr = String(date.getMonth() + 1).padStart(2, "0");
  const monthFolderId = await getOrCreateFolder(accessToken, monthStr, yearFolderId);

  return { rootFolderId, targetFolderId: monthFolderId };
}

export async function findExistingFile(
  accessToken: string,
  fileName: string,
  folderId: string,
): Promise<{ id: string; webViewLink?: string } | null> {
  const query = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query,
  )}&fields=files(id,name,webViewLink)&spaces=drive`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string; webViewLink?: string }[] };
  return data.files && data.files.length > 0 ? data.files[0]! : null;
}

async function uploadMultipart(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null,
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const isUpdate = !!existingFileId;
  const boundary = `-------314159265358979323846`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: "application/pdf",
  };
  if (!isUpdate) {
    metadata["parents"] = [targetFolderId];
  }

  const endpoint = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`;

  const method = isUpdate ? "PATCH" : "POST";

  const enc = new TextEncoder();
  const header = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata,
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

  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}

async function uploadResumable(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null,
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const isUpdate = !!existingFileId;
  const initUrl = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink`;

  const method = isUpdate ? "PATCH" : "POST";

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: "application/pdf",
  };
  if (!isUpdate) {
    metadata["parents"] = [targetFolderId];
  }

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

  const uploadRes = await fetch(uploadLocation, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBytes.length),
    },
    body: pdfBytes as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Resumable upload body transfer failed: ${err}`);
  }

  return (await uploadRes.json()) as { id: string; name: string; webViewLink?: string };
}

export async function uploadPdfWithRetry(
  accessToken: string,
  targetFolderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  existingFileId?: string | null,
): Promise<{ id: string; name: string; webViewLink?: string }> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (pdfBytes.length > 5 * 1024 * 1024) {
        return await uploadResumable(
          accessToken,
          targetFolderId,
          fileName,
          pdfBytes,
          existingFileId,
        );
      } else {
        return await uploadMultipart(
          accessToken,
          targetFolderId,
          fileName,
          pdfBytes,
          existingFileId,
        );
      }
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError || new Error("Upload failed after 3 attempts");
}

function getTodayDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function generateAttendancePdfText(
  dateStr: string,
  records: Array<{
    people?: { person_code?: string; name?: string; department?: string } | null;
    check_in?: string | null;
    check_out?: string | null;
    status?: string | null;
  }>,
  orgName: string,
): Uint8Array {
  const lines: string[] = [];
  lines.push(`%PDF-1.4`);
  lines.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  lines.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  lines.push(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
  );

  let textStream = `BT\n/F1 16 Tf\n50 740 Td\n(${orgName} - Daily Attendance Report) Tj\n`;
  textStream += `/F1 11 Tf\n0 -22 Td\n(Date: ${dateStr}   |   Generated: ${new Date().toLocaleTimeString()}) Tj\n`;
  textStream += `/F1 10 Tf\n0 -30 Td\n(---------------------------------------------------------------------------------------) Tj\n`;
  textStream += `0 -18 Td\n(ID          NAME                           DEPARTMENT      CHECK-IN   CHECK-OUT   STATUS) Tj\n`;
  textStream += `0 -12 Td\n(---------------------------------------------------------------------------------------) Tj\n`;

  let yOffset = -18;
  if (records.length === 0) {
    textStream += `0 ${yOffset} Td\n(No attendance records logged for today.) Tj\n`;
  } else {
    for (const r of records.slice(0, 32)) {
      const code = (r.people?.person_code || "N/A").padEnd(10);
      const name = (r.people?.name || "Unknown").slice(0, 28).padEnd(30);
      const dept = (r.people?.department || "General").slice(0, 14).padEnd(16);
      const inTime = r.check_in
        ? new Date(r.check_in)
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            .padEnd(11)
        : "—          ";
      const outTime = r.check_out
        ? new Date(r.check_out)
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            .padEnd(12)
        : "—           ";
      const status = (r.status || "present").toUpperCase();

      const line = `${code} ${name} ${dept} ${inTime} ${outTime} ${status}`;
      textStream += `0 ${yOffset} Td\n(${line.replace(/[()]/g, "")}) Tj\n`;
      yOffset = -16;
    }
  }

  textStream += `ET`;

  const streamBytes = new TextEncoder().encode(textStream);
  lines.push(
    `4 0 obj << /Length ${streamBytes.length} >> stream\n${textStream}\nendstream\nendobj`,
  );
  lines.push(`5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  lines.push(
    `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000${244 + streamBytes.length + 50} 00000 n \n`,
  );
  lines.push(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${350 + streamBytes.length}\n%%EOF`);

  return new TextEncoder().encode(lines.join("\n"));
}

export async function handleGoogleDriveDailyBackup(
  request: Request,
  env?: unknown,
): Promise<Response> {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  let backupId: string | null = null;
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { backup_id?: string };
      if (body?.backup_id) backupId = body.backup_id;
    } catch {
      // Body may be empty
    }
  }

  const { clientId, clientSecret, supabaseUrl, serviceRoleKey } = await getCredentials(env);
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing server database credentials" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch connection
    const { data: connection } = await supabase
      .from("drive_connection")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Google Drive is not connected. Please connect Google Drive in Settings first.",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const todayStr = getTodayDateKey();
    const fileName = `attendance_${todayStr}.pdf`;

    // 2. Fetch org settings & today's attendance
    const [{ data: settings }, { data: records }] = await Promise.all([
      supabase.from("settings").select("org_name").eq("id", 1).maybeSingle(),
      supabase
        .from("attendance")
        .select("*, people!inner(*)")
        .eq("date", todayStr)
        .order("check_in", { ascending: true }),
    ]);

    const orgName = settings?.org_name || "FaceTime Attendance";
    const pdfBytes = generateAttendancePdfText(todayStr, (records as any[]) ?? [], orgName);

    // 3. Register or reuse pending backup record
    let currentBackupId = backupId;
    if (currentBackupId) {
      await supabase
        .from("drive_backups")
        .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", currentBackupId);
    } else {
      const { data: backupRecord } = await supabase
        .from("drive_backups")
        .insert({
          file_type: "attendance",
          file_name: fileName,
          period_start: todayStr,
          period_end: todayStr,
          status: "pending",
        })
        .select("id")
        .single();
      currentBackupId = backupRecord?.id || null;
    }

    // 4. Decrypt token & refresh
    const refreshToken = await decryptToken(connection.refresh_token_encrypted, serviceRoleKey, env);
    const accessToken = await refreshAccessToken(refreshToken, clientId, clientSecret);

    // 5. Target folder
    const { rootFolderId, targetFolderId } = await resolveTargetFolder(
      accessToken,
      "attendance",
      connection.root_folder_id,
      new Date(),
    );

    // Update root folder id if missing
    if (!connection.root_folder_id && rootFolderId) {
      await supabase
        .from("drive_connection")
        .update({ root_folder_id: rootFolderId, updated_at: new Date().toISOString() })
        .eq("id", connection.id);
    }

    const existingFile = await findExistingFile(accessToken, fileName, targetFolderId);

    // 6. Upload
    const result = await uploadPdfWithRetry(
      accessToken,
      targetFolderId,
      fileName,
      pdfBytes,
      existingFile?.id || null,
    );

    const driveLink =
      result.webViewLink || `https://drive.google.com/file/d/${result.id}/view?usp=sharing`;

    if (currentBackupId) {
      await supabase
        .from("drive_backups")
        .update({
          status: "success",
          drive_file_id: result.id,
          drive_link: driveLink,
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", currentBackupId);
    }

    await supabase.from("audit_logs").insert({
      action: "google_drive_backup_created",
      details: {
        file_name: fileName,
        file_id: result.id,
        drive_link: driveLink,
        status: "success",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        file_id: result.id,
        drive_link: driveLink,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err: any) {
    const errorMsg = err?.message || "Daily backup failed";
    console.error("Daily backup failed:", errorMsg);

    if (backupId) {
      const { data: bRec } = await supabase
        .from("drive_backups")
        .select("retry_count")
        .eq("id", backupId)
        .single();
      await supabase
        .from("drive_backups")
        .update({
          status: "failed",
          error_message: errorMsg,
          retry_count: (bRec?.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", backupId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function handleGoogleDriveUpload(
  request: Request,
  env?: unknown,
): Promise<Response> {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  let payload: {
    file_type?: "report" | "attendance";
    file_name?: string;
    pdf_base64?: string;
    period_start?: string;
    period_end?: string;
    backup_id?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON request body" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const { file_type, file_name, pdf_base64, period_start, period_end, backup_id } = payload;
  if (!file_type || !file_name || !pdf_base64) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing required fields: file_type, file_name, pdf_base64",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const { clientId, clientSecret, supabaseUrl, serviceRoleKey } = await getCredentials(env);
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing server database credentials" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Check drive connection
  const { data: connection } = await supabase
    .from("drive_connection")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!connection) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Google Drive is not connected",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  // 2. Track backup in DB
  let currentBackupId = backup_id;
  if (!currentBackupId) {
    const { data: inserted, error: insertErr } = await supabase
      .from("drive_backups")
      .insert({
        file_type,
        file_name,
        period_start: period_start || null,
        period_end: period_end || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (!insertErr && inserted?.id) {
      currentBackupId = inserted.id;
    }
  } else {
    await supabase
      .from("drive_backups")
      .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", currentBackupId);
  }

  try {
    // 3. Decode base64 to binary
    const binaryStr = atob(pdf_base64);
    const pdfBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pdfBytes[i] = binaryStr.charCodeAt(i);
    }

    // 4. Decrypt token & refresh
    const refreshToken = await decryptToken(connection.refresh_token_encrypted, serviceRoleKey, env);
    const accessToken = await refreshAccessToken(refreshToken, clientId, clientSecret);

    // 5. Target folder
    const dateForFolder = period_start ? new Date(period_start) : new Date();
    const { rootFolderId, targetFolderId } = await resolveTargetFolder(
      accessToken,
      file_type,
      connection.root_folder_id,
      dateForFolder,
    );

    if (!connection.root_folder_id && rootFolderId) {
      await supabase
        .from("drive_connection")
        .update({ root_folder_id: rootFolderId, updated_at: new Date().toISOString() })
        .eq("id", connection.id);
    }

    // 6. Check existing file
    const existingFile = await findExistingFile(accessToken, file_name, targetFolderId);

    // 7. Upload PDF
    const result = await uploadPdfWithRetry(
      accessToken,
      targetFolderId,
      file_name,
      pdfBytes,
      existingFile?.id || null,
    );

    const driveLink =
      result.webViewLink || `https://drive.google.com/file/d/${result.id}/view?usp=sharing`;

    if (currentBackupId) {
      await supabase
        .from("drive_backups")
        .update({
          status: "success",
          drive_file_id: result.id,
          drive_link: driveLink,
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", currentBackupId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_id: result.id,
        drive_link: driveLink,
        file_name,
        is_update: !!existingFile,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err: any) {
    const errorMsg = err?.message || "Upload failed";
    console.error("Upload to Google Drive failed:", errorMsg);

    if (currentBackupId) {
      const { data: bRec } = await supabase
        .from("drive_backups")
        .select("retry_count")
        .eq("id", currentBackupId)
        .single();
      await supabase
        .from("drive_backups")
        .update({
          status: "failed",
          error_message: errorMsg,
          retry_count: (bRec?.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBackupId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function handleGoogleDriveAuthStart(
  request: Request,
  env?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") || `${url.origin}/settings`;
  const { clientId } = await getCredentials(env);

  if (!clientId) {
    const errorUrl = new URL(returnTo, url.origin);
    errorUrl.searchParams.set("drive_error", "Missing Google Client ID in server configuration");
    return Response.redirect(errorUrl.toString(), 302);
  }

  const redirectUri = `${url.origin}/api/integrations/google-drive/callback`;
  const state = btoa(JSON.stringify({ return_to: returnTo }));

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
  );
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  googleAuthUrl.searchParams.set("state", state);

  return Response.redirect(googleAuthUrl.toString(), 302);
}

export async function handleGoogleDriveOAuthCallback(
  request: Request,
  env?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  let returnTo = "/settings";
  if (stateParam) {
    try {
      const decoded = JSON.parse(atob(stateParam)) as { return_to?: string };
      if (decoded.return_to) returnTo = decoded.return_to;
    } catch {
      // ignore
    }
  }

  const getRedirectUrl = (baseReturnTo: string) => {
    return baseReturnTo.startsWith("http://") || baseReturnTo.startsWith("https://")
      ? new URL(baseReturnTo)
      : new URL(baseReturnTo, url.origin);
  };

  if (errorParam) {
    console.error("Google OAuth error:", errorParam);
    const redirectUrl = getRedirectUrl(returnTo);
    redirectUrl.searchParams.set("drive_error", errorParam);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (!code) {
    const redirectUrl = getRedirectUrl(returnTo);
    redirectUrl.searchParams.set("drive_error", "missing_code");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  try {
    const { clientId, clientSecret, supabaseUrl, serviceRoleKey } = await getCredentials(env);
    if (!clientId || !clientSecret) {
      throw new Error("Missing Google OAuth credentials (client ID or secret)");
    }

    const redirectUri = `${url.origin}${url.pathname}`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // 2. Fetch authenticated Google profile email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = (await userRes.json()) as { email?: string };
    const googleEmail = userData.email || "Unknown Account";

    // 3. Create or get "FaceAttendance Backups" folder
    let rootFolderId = "";
    try {
      rootFolderId = await getOrCreateFolder(accessToken, "FaceAttendance Backups");
    } catch (folderErr) {
      console.warn("Folder creation warning:", folderErr);
    }

    // 4. Encrypt refresh token
    const encryptedToken = refreshToken ? await encryptToken(refreshToken, serviceRoleKey) : "";

    // 5. Save to Supabase drive_connection table
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await supabase
      .from("drive_connection")
      .select("id, refresh_token_encrypted")
      .limit(1)
      .maybeSingle();

    const recordData: Record<string, unknown> = {
      google_email: googleEmail,
      root_folder_id: rootFolderId || null,
      updated_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      auto_backup_on_pdf: true,
      daily_backup: true,
      daily_backup_enabled: true,
    };

    if (encryptedToken) {
      recordData["refresh_token_encrypted"] = encryptedToken;
    } else if (existing?.refresh_token_encrypted) {
      recordData["refresh_token_encrypted"] = existing.refresh_token_encrypted;
    } else {
      throw new Error(
        "No refresh token received. Please remove app access in Google Security settings and reconnect.",
      );
    }

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("drive_connection")
        .update(recordData)
        .eq("id", existing.id);
      if (updateErr) throw new Error(updateErr.message || "Failed to update drive connection");
    } else {
      const { error: insertErr } = await supabase.from("drive_connection").insert(recordData);
      if (insertErr) throw new Error(insertErr.message || "Failed to save drive connection");
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "google_drive_connected",
      details: { email: googleEmail, root_folder_id: rootFolderId },
    });

    const redirectUrl = getRedirectUrl(returnTo);
    redirectUrl.searchParams.set("drive_connected", "true");
    redirectUrl.searchParams.set("drive_email", googleEmail);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Authentication failed";
    console.error("Google Drive OAuth Callback error:", errorMsg);
    const redirectUrl = getRedirectUrl(returnTo);
    redirectUrl.searchParams.set("drive_error", encodeURIComponent(errorMsg));
    return Response.redirect(redirectUrl.toString(), 302);
  }
}
