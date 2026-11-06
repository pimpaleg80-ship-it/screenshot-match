import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey, formatHours, totalHours, formatTime } from "@/lib/attendance";

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string | undefined;
  fileName: string;
  fileType: "report" | "attendance";
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  headers: string[];
  rows: (string | number | null)[][];
  autoBackup?: boolean | undefined;
}

/**
 * Creates a professional PDF document using jsPDF + autoTable,
 * triggers browser download, and automatically backs it up to Google Drive.
 */
export async function generateAndBackupPdf(options: GeneratePdfOptions): Promise<void> {
  const {
    title,
    subtitle,
    fileName,
    fileType,
    periodStart,
    periodEnd,
    headers,
    rows,
    autoBackup = true,
  } = options;

  try {
    // 1. Generate jsPDF
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    // Header styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 40, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const sub = subtitle || `Generated on ${new Date().toLocaleString()} • Flowpeople by Fluxora`;
    doc.text(sub, 40, 62);

    // Render table
    autoTable(doc, {
      startY: 75,
      head: [headers],
      body: rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229], // Primary indigo
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 5,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 40, right: 40 },
    });

    // Save/Download to client
    doc.save(fileName);

    // 2. Automated background backup to Google Drive
    if (autoBackup) {
      // Non-blocking background call
      backupPdfToDrive({
        doc,
        fileType,
        fileName,
        periodStart,
        periodEnd,
      }).catch((e) => {
        console.warn("Background Drive backup non-fatal warning:", e);
      });
    }
  } catch (err: unknown) {
    console.error("PDF generation failed:", err);
    toast.error("Failed to generate PDF document");
  }
}

/**
 * Generate monthly PDF attendance ledger for an individual employee
 */
export async function generateMonthlyEmployeeAttendancePdf(
  employeeId: string,
  employeeName: string,
  year: number,
  month: number
): Promise<void> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: records, error } = await supabase
    .from("attendance")
    .select("date, check_in, check_out, status, total_hours, method")
    .eq("employee_id", employeeId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    toast.error("Failed to load employee attendance records for archive");
    return;
  }

  const rows = (records || []).map((r) => [
    r.date,
    r.check_in ? formatTime(r.check_in) : "--",
    r.check_out ? formatTime(r.check_out) : "--",
    r.total_hours ? `${r.total_hours}h` : r.check_in && r.check_out ? formatHours(totalHours(r.check_in, r.check_out)) : "--",
    r.status?.toUpperCase() || "PRESENT",
    r.method || "manual_geofence",
  ]);

  await generateAndBackupPdf({
    title: `Monthly Attendance Report — ${employeeName}`,
    subtitle: `Period: ${startDate} to ${endDate} • Organization Archive`,
    fileName: `Attendance_${employeeName.replace(/\s+/g, "_")}_${year}_${String(month).padStart(2, "0")}.pdf`,
    fileType: "attendance",
    periodStart: startDate,
    periodEnd: endDate,
    headers: ["Date", "Check-In", "Check-Out", "Hours", "Status", "Verification Method"],
    rows,
  });
}

/**
 * Generate monthly master organization attendance summary PDF
 */
export async function generateMonthlyOrgMasterPdf(
  organizationId: string,
  organizationName: string,
  year: number,
  month: number
): Promise<void> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, departments(name)")
    .order("full_name");

  if (!employees || employees.length === 0) {
    toast.error("No employees found to generate master archive");
    return;
  }

  const { data: attendanceLogs } = await supabase
    .from("attendance")
    .select("employee_id, status, total_hours")
    .gte("date", startDate)
    .lte("date", endDate);

  const empMap = new Map<string, { present: number; late: number; totalHours: number }>();
  for (const emp of employees) {
    empMap.set(emp.id, { present: 0, late: 0, totalHours: 0 });
  }

  for (const log of attendanceLogs || []) {
    const stats = empMap.get(log.employee_id);
    if (stats) {
      if (log.status === "present") stats.present += 1;
      if (log.status === "late") {
        stats.late += 1;
        stats.present += 1;
      }
      if (log.total_hours) stats.totalHours += Number(log.total_hours);
    }
  }

  const rows = employees.map((emp) => {
    const stats = empMap.get(emp.id) || { present: 0, late: 0, totalHours: 0 };
    return [
      emp.employee_code,
      emp.full_name,
      (emp as { departments?: { name: string } | null }).departments?.name || "General",
      stats.present,
      stats.late,
      `${stats.totalHours.toFixed(1)} hrs`,
    ];
  });

  await generateAndBackupPdf({
    title: `Master Workforce Attendance Summary — ${organizationName}`,
    subtitle: `Billing & Compliance Archive • Period: ${startDate} to ${endDate}`,
    fileName: `Master_Attendance_${organizationName.replace(/\s+/g, "_")}_${year}_${String(month).padStart(2, "0")}.pdf`,
    fileType: "report",
    periodStart: startDate,
    periodEnd: endDate,
    headers: ["Emp Code", "Employee Name", "Department", "Days Present", "Late Marks", "Total Hours Logged"],
    rows,
  });
}

/**
 * Background worker to upload a jsPDF instance to Google Drive via Supabase Edge Function
 */
async function backupPdfToDrive({
  doc,
  fileType,
  fileName,
  periodStart,
  periodEnd,
}: {
  doc: jsPDF;
  fileType: "report" | "attendance";
  fileName: string;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
}) {
  try {
    // Check if drive connection exists first
    const { data: connection } = await supabase
      .from("drive_connection")
      .select("auto_backup_on_pdf, google_email")
      .limit(1)
      .maybeSingle();

    if (!connection || connection.auto_backup_on_pdf === false) {
      return; // Not connected or auto-backup toggled off
    }

    // Convert PDF binary to base64
    const pdfDataUri = doc.output("datauristring");
    const base64Data = pdfDataUri.split(",")[1];
    if (!base64Data) return;

    // Invoke google-drive-upload edge function
    const { data, error } = await supabase.functions.invoke("google-drive-upload", {
      body: {
        file_type: fileType,
        file_name: fileName,
        pdf_base64: base64Data,
        period_start: periodStart || toDateKey(),
        period_end: periodEnd || toDateKey(),
      },
    });

    if (error) {
      console.warn("Drive backup error:", error.message);
      return;
    }

    if (data?.success) {
      toast.success(`Backed up ${fileName} to Google Drive`, {
        description: `Saved in ${connection.google_email}'s Drive`,
      });
    }
  } catch (err) {
    // Non-blocking: failure must never break attendance or document download
    console.warn("Drive backup exception:", err);
  }
}
