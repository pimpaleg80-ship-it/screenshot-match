import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/attendance";

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
    const sub = subtitle || `Generated on ${new Date().toLocaleString()} • FaceTime Attendance`;
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
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    toast.error("Failed to generate PDF document");
  }
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
