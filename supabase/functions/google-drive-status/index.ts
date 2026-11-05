import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { refreshAccessToken } from "../_shared/google-drive.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase server credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body if action was requested (e.g. disconnect or toggle settings)
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // 1. Fetch connection
    const { data: connection, error } = await supabase
      .from("drive_connection")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Handle Disconnect action
    if (body.action === "disconnect") {
      if (connection) {
        await supabase.from("drive_connection").delete().eq("id", connection.id);
        await supabase.from("audit_logs").insert({
          action: "google_drive_disconnected",
          details: { email: connection.google_email },
        });
      }
      return new Response(
        JSON.stringify({ connected: false, message: "Google Drive disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle Toggle settings (auto_backup_on_pdf, daily_backup_enabled)
    if (body.action === "update_settings" && connection) {
      const updateData: Record<string, boolean> = {};
      if (typeof body.auto_backup_on_pdf === "boolean") {
        updateData.auto_backup_on_pdf = body.auto_backup_on_pdf;
      }
      if (typeof body.daily_backup_enabled === "boolean") {
        updateData.daily_backup_enabled = body.daily_backup_enabled;
      }

      await supabase
        .from("drive_connection")
        .update(updateData)
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connection) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch last backup timestamp
    const { data: lastBackup } = await supabase
      .from("drive_backups")
      .select("created_at, file_name, status")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Test token validity
    let isRevoked = false;
    try {
      const refreshToken = await decryptToken(connection.refresh_token_encrypted);
      await refreshAccessToken(refreshToken);
    } catch (testErr: any) {
      if (testErr.message && testErr.message.includes("REVOKED")) {
        isRevoked = true;
      }
    }

    return new Response(
      JSON.stringify({
        connected: !isRevoked,
        revoked: isRevoked,
        email: connection.google_email,
        connected_at: connection.connected_at,
        auto_backup_on_pdf: connection.auto_backup_on_pdf,
        daily_backup_enabled: connection.daily_backup_enabled,
        last_backup_at: lastBackup?.created_at || null,
        last_backup_file: lastBackup?.file_name || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to check Drive status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
