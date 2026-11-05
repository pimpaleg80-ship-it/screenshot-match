import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken } from "../_shared/crypto.ts";
import { getOrCreateFolder } from "../_shared/google-drive.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  let returnTo = "/settings";
  if (stateParam) {
    try {
      const decoded = JSON.parse(atob(stateParam));
      if (decoded.return_to) returnTo = decoded.return_to;
    } catch {
      // Ignore state parse failure
    }
  }

  // Handle Google OAuth error
  if (errorParam) {
    console.error("Google OAuth error:", errorParam);
    const redirectUrl = new URL(returnTo, url.origin);
    redirectUrl.searchParams.set("drive_error", errorParam);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (!code) {
    const redirectUrl = new URL(returnTo, url.origin);
    redirectUrl.searchParams.set("drive_error", "missing_code");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId || !clientSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required server environment variables for Google Drive auth");
    }

    const explicitRedirect = Deno.env.get("GOOGLE_REDIRECT_URI");
    const redirectUri =
      explicitRedirect ||
      `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/google-drive-auth-callback`;

    // 1. Exchange code for tokens
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

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Failed token exchange");
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      console.warn("No refresh_token returned. Prompting consent might be required.");
    }

    // 2. Fetch authenticated Google email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();
    const googleEmail = userData.email || "Unknown Account";

    // 3. Create root folder "FaceAttendance Backups" in Google Drive
    const rootFolderId = await getOrCreateFolder(accessToken, "FaceAttendance Backups");

    // 4. Encrypt refresh token
    const encryptedToken = refreshToken
      ? await encryptToken(refreshToken)
      : "";

    // 5. Save into Supabase drive_connection table
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check existing connection
    const { data: existing } = await supabase
      .from("drive_connection")
      .select("id, refresh_token_encrypted")
      .limit(1)
      .maybeSingle();

    const recordData: Record<string, any> = {
      google_email: googleEmail,
      root_folder_id: rootFolderId,
      updated_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
    };

    if (encryptedToken) {
      recordData.refresh_token_encrypted = encryptedToken;
    } else if (existing?.refresh_token_encrypted) {
      // Retain existing refresh token if Google didn't reissue on re-auth
      recordData.refresh_token_encrypted = existing.refresh_token_encrypted;
    } else {
      throw new Error("No refresh token received. Please remove app access in Google Security settings and reconnect.");
    }

    if (existing?.id) {
      await supabase.from("drive_connection").update(recordData).eq("id", existing.id);
    } else {
      await supabase.from("drive_connection").insert(recordData);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "google_drive_connected",
      details: { email: googleEmail, root_folder_id: rootFolderId },
    });

    // Redirect user back to settings with success param
    const redirectUrl = new URL(returnTo, url.origin);
    redirectUrl.searchParams.set("drive_connected", "true");
    redirectUrl.searchParams.set("drive_email", googleEmail);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err: any) {
    console.error("Callback error:", err);
    const redirectUrl = new URL(returnTo, url.origin);
    redirectUrl.searchParams.set("drive_error", encodeURIComponent(err.message || "Unknown error"));
    return Response.redirect(redirectUrl.toString(), 302);
  }
});

