import { useState, useRef } from "react";
import { Download, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export interface CsvEmployeeRecord {
  full_name: string;
  email: string;
  phone?: string | undefined;
  employee_code?: string | undefined;
  department?: string | undefined;
  designation?: string | undefined;
  employment_type?: string | undefined;
  work_location?: string | undefined;
  joining_date?: string | undefined;
  status?: string | undefined;
}

interface CsvImportExportProps {
  employees: any[];
  onImportSuccess: () => void;
  importFunction: (records: CsvEmployeeRecord[]) => Promise<{ imported: number; errors: string[] }>;
}

export function CsvImportExport({
  employees,
  onImportSuccess,
  importFunction,
}: CsvImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<CsvEmployeeRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // Export CSV
  // --------------------------------------------------------------------------
  function handleExportCsv() {
    if (!employees || employees.length === 0) {
      toast.error("No employee records to export");
      return;
    }

    const headers = [
      "Employee Code",
      "Full Name",
      "Email",
      "Phone",
      "Department",
      "Designation",
      "Reporting Manager",
      "Joining Date",
      "Employment Type",
      "Work Location",
      "Status",
    ];

    const rows = employees.map((emp) => [
      emp.person_code || emp.employee_code || "",
      `"${(emp.name || emp.full_name || "").replace(/"/g, '""')}"`,
      emp.email || "",
      emp.phone || "",
      `"${(emp.department || "General").replace(/"/g, '""')}"`,
      `"${(emp.designation || "Employee").replace(/"/g, '""')}"`,
      `"${(emp.manager_name || "").replace(/"/g, '""')}"`,
      emp.joining_date || "",
      emp.employment_type || "Full-Time",
      emp.work_location || "Onsite",
      emp.status || (emp.active ? "Active" : "Inactive"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `flowpeople_employees_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${employees.length} employee records to CSV`);
  }

  // --------------------------------------------------------------------------
  // Import CSV - Parse & Validate
  // --------------------------------------------------------------------------
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) {
          toast.error("File is empty");
          return;
        }

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          toast.error("CSV must contain a header row and at least one employee row");
          return;
        }

        // Parse headers (case-insensitive)
        const headerCols = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().trim());
        const nameIdx = headerCols.findIndex((h) => h.includes("name"));
        const emailIdx = headerCols.findIndex((h) => h.includes("email"));
        const phoneIdx = headerCols.findIndex((h) => h.includes("phone"));
        const codeIdx = headerCols.findIndex((h) => h.includes("code") || h.includes("id"));
        const deptIdx = headerCols.findIndex((h) => h.includes("dept") || h.includes("department"));
        const desigIdx = headerCols.findIndex((h) => h.includes("desig") || h.includes("title"));
        const typeIdx = headerCols.findIndex((h) => h.includes("type"));
        const locIdx = headerCols.findIndex((h) => h.includes("location"));
        const dateIdx = headerCols.findIndex((h) => h.includes("join") || h.includes("date"));

        if (nameIdx === -1 || emailIdx === -1) {
          toast.error("CSV must include at least 'Full Name' and 'Email' columns");
          return;
        }

        const records: CsvEmployeeRecord[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]!);
          const fullName = cols[nameIdx]?.trim() || "";
          const email = cols[emailIdx]?.trim() || "";

          if (!fullName) {
            errors.push(`Row ${i + 1}: Missing Full Name`);
            continue;
          }
          if (!email || !email.includes("@")) {
            errors.push(`Row ${i + 1}: Invalid or missing email (${email})`);
            continue;
          }

          records.push({
            full_name: fullName,
            email: email.toLowerCase(),
            phone: phoneIdx !== -1 ? cols[phoneIdx]?.trim() : undefined,
            employee_code: codeIdx !== -1 ? cols[codeIdx]?.trim() : undefined,
            department: deptIdx !== -1 ? cols[deptIdx]?.trim() || "General" : "General",
            designation: desigIdx !== -1 ? cols[desigIdx]?.trim() || "Employee" : "Employee",
            employment_type: typeIdx !== -1 ? cols[typeIdx]?.trim() || "full_time" : "full_time",
            work_location: locIdx !== -1 ? cols[locIdx]?.trim() || "onsite" : "onsite",
            joining_date: dateIdx !== -1 ? cols[dateIdx]?.trim() : undefined,
            status: "active",
          });
        }

        setParsedRows(records);
        setValidationErrors(errors);
        setImportDialogOpen(true);
      } catch (err: any) {
        toast.error("Failed to parse CSV file: " + (err.message || "Invalid format"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  }

  // Simple CSV line parser respecting quotes
  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // --------------------------------------------------------------------------
  // Confirm and Execute Import
  // --------------------------------------------------------------------------
  async function handleConfirmImport() {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await importFunction(parsedRows);
      if (res.imported > 0) {
        toast.success(`Successfully registered and imported ${res.imported} employees!`);
        onImportSuccess();
        setImportDialogOpen(false);
        setParsedRows([]);
        setValidationErrors([]);
      } else if (res.errors.length > 0) {
        toast.error(`Import failed: ${res.errors.join(", ")}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Hidden input for CSV file upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Import CSV</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium"
          onClick={handleExportCsv}
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="h-5 w-5 text-primary" />
              Import Employees from CSV
            </DialogTitle>
            <DialogDescription>
              Preview validated employee records ready to be registered in FlowPeople.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 my-2 pr-1">
            <div className="flex items-center justify-between text-xs font-medium rounded-lg bg-muted/50 p-3">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {parsedRows.length} valid employee record{parsedRows.length === 1 ? "" : "s"} ready
              </span>
              {validationErrors.length > 0 && (
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  {validationErrors.length} invalid row{validationErrors.length === 1 ? "" : "s"} skipped
                </span>
              )}
            </div>

            {/* Validation warning list */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 p-3 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <p className="font-semibold">Skipped Rows:</p>
                <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Table Preview */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5">Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-2.5 font-medium">{row.full_name}</td>
                      <td className="p-2.5 text-muted-foreground">{row.email}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px]">
                          {row.department || "General"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground">{row.designation || "Employee"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/20 border-t">
                  + {parsedRows.length - 10} more rows...
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || isImporting}
              className="gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Registering Accounts...</span>
                </>
              ) : (
                <span>Register {parsedRows.length} Employees</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
