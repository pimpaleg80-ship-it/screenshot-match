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
