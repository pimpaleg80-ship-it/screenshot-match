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

// Helper to format ISO date to YYYY-MM-DD
function getTodayDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Generate simple PDF bytes for daily attendance report
function generateAttendancePdfText(dateStr: string, records: any[], orgName: string): Uint8Array {
  // Simple PDF generator in pure TypeScript for Edge runtime without browser DOM
  const lines: string[] = [];
  lines.push(`%PDF-1.4`);
  lines.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  lines.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  lines.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`);

  // Build stream content
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
      const inTime = r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).padEnd(11) : "—          ";
      const outTime = r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).padEnd(12) : "—           ";
      const status = (r.status || "present").toUpperCase();

      const line = `${code} ${name} ${dept} ${inTime} ${outTime} ${status}`;
      textStream += `0 ${yOffset} Td\n(${line.replace(/[()]/g, "")}) Tj\n`;
      yOffset = -16;
    }
  }

  textStream += `ET`;

  const streamBytes = new TextEncoder().encode(textStream);
  lines.push(`4 0 obj << /Length ${streamBytes.length} >> stream\n${textStream}\nendstream\nendobj`);
  lines.push(`5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  lines.push(`xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000${244 + streamBytes.length + 50} 00000 n \n`);
  lines.push(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${350 + streamBytes.length}\n%%EOF`);

  return new TextEncoder().encode(lines.join("\n"));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing server environment credentials" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Check drive connection
    const { data: connection } = await supabase
      .from("drive_connection")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "Google Drive is not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const todayStr = getTodayDateKey();
    const fileName = `attendance_${todayStr}.pdf`;

    // 2. Fetch org name & today's attendance
    const [{ data: settings }, { data: records }] = await Promise.all([
      supabase.from("settings").select("org_name").eq("id", 1).single(),
      supabase
        .from("attendance")
        .select("*, people!inner(*)")
        .eq("date", todayStr)
        .order("check_in", { ascending: true }),
    ]);

    const orgName = settings?.org_name || "FaceTime Attendance";
    const pdfBytes = generateAttendancePdfText(todayStr, records ?? [], orgName);

    // 3. Register pending backup record
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

    // 4. Decrypt token & upload
    const refreshToken = await decryptToken(connection.refresh_token_encrypted);
    const accessToken = await refreshAccessToken(refreshToken);

    const { rootFolderId, targetFolderId } = await resolveTargetFolder(
      accessToken,
      "attendance",
      connection.root_folder_id,
      new Date()
    );

    const existingFile = await findExistingFile(accessToken, fileName, targetFolderId);

    const result = await uploadPdfWithRetry(
      accessToken,
      targetFolderId,
      fileName,
      pdfBytes,
      existingFile?.id || null
    );

    const driveLink =
      result.webViewLink ||
      `https://drive.google.com/file/d/${result.id}/view?usp=sharing`;

    if (backupRecord?.id) {
      await supabase
        .from("drive_backups")
        .update({
          status: "success",
          drive_file_id: result.id,
          drive_link: driveLink,
          updated_at: new Date().toISOString(),
        })
        .eq("id", backupRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        file_id: result.id,
        drive_link: driveLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Daily backup failed:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Daily backup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

