import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import {
  refreshAccessToken,
  resolveTargetFolder,
  findExistingFile,
  uploadPdfWithRetry,
} from "../_shared/google-drive.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase server credentials" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const {
    file_type,
    file_name,
    pdf_base64,
    period_start,
    period_end,
    backup_id,
  } = payload;

  if (!file_type || !file_name || !pdf_base64) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: file_type, file_name, pdf_base64" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Check Drive connection
  const { data: connection } = await supabase
    .from("drive_connection")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!connection) {
    return new Response(
      JSON.stringify({ error: "Google Drive is not connected" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Track backup record in DB
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

    if (insertErr) {
      console.error("Backup insert error:", insertErr);
    } else {
      currentBackupId = inserted.id;
    }
  } else {
    await supabase
      .from("drive_backups")
      .update({ status: "pending", error_message: null })
      .eq("id", currentBackupId);
  }

  try {
    // 3. Convert base64 to binary
    const binaryStr = atob(pdf_base64);
    const pdfBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      pdfBytes[i] = binaryStr.charCodeAt(i);
    }

    // 4. Decrypt refresh token and get fresh access token
    const refreshToken = await decryptToken(connection.refresh_token_encrypted);
    const accessToken = await refreshAccessToken(refreshToken);

    // 5. Resolve folder structure: FaceAttendance Backups / {Reports | Attendance} / YYYY / MM
    const dateForFolder = period_start ? new Date(period_start) : new Date();
    const { rootFolderId, targetFolderId } = await resolveTargetFolder(
      accessToken,
      file_type,
      connection.root_folder_id,
      dateForFolder
    );

    // Update root_folder_id on connection if newly set
    if (!connection.root_folder_id && rootFolderId) {
      await supabase
        .from("drive_connection")
        .update({ root_folder_id: rootFolderId })
        .eq("id", connection.id);
    }

    // 6. Check if file already exists with same name to prevent duplicates
    const existingFile = await findExistingFile(accessToken, file_name, targetFolderId);

    // 7. Upload or update PDF (with automatic retry)
    const result = await uploadPdfWithRetry(
      accessToken,
      targetFolderId,
      file_name,
      pdfBytes,
      existingFile?.id || null
    );

    const driveLink =
      result.webViewLink ||
      `https://drive.google.com/file/d/${result.id}/view?usp=sharing`;

    // 8. Update DB backup log on success
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (uploadErr: any) {
    console.error("Upload failed:", uploadErr);

    // Record failure in DB
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
          error_message: uploadErr.message || "Failed uploading to Google Drive",
          retry_count: (bRec?.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBackupId);
    }

    return new Response(
      JSON.stringify({
        error: uploadErr.message || "Upload failed",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

