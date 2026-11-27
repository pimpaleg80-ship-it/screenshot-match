import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, FileText, CheckCircle2 } from "lucide-react";
import { PayslipItem, MONTH_NAMES, formatINR, numberToWordsIndian, generatePayslipPDF } from "@/lib/payroll";
import { BrandLogo } from "@/components/brand-logo";

interface PayslipViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslip: PayslipItem | null;
  organizationName?: string;
}

export function PayslipViewDialog({
  open,
  onOpenChange,
  payslip,
  organizationName = "FlowPeople Organization",
}: PayslipViewDialogProps) {
  if (!payslip) return null;

  const monthName = MONTH_NAMES[(payslip.month - 1) % 12];
  const emp = payslip.employee || {
    full_name: "Employee",
    employee_code: "EMP",
    designation: "Staff",
    department: { name: "General" },
  };

  function handleDownloadPDF() {
    if (!payslip) return;
    const doc = generatePayslipPDF({
      payslip,
      employee: {
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        designation: emp.designation,
        department_name: emp.department?.name,
        bank_name: payslip.bank_name,
        account_number: payslip.account_number,
        pan_number: payslip.pan_number,
        uan_number: payslip.uan_number,
      },
      organizationName,
    });
    doc.save(`Payslip_${emp.employee_code}_${monthName}_${payslip.year}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Monthly Compensation Statement
              </DialogTitle>
              <DialogDescription className="text-xs">
                Official payslip for {emp.full_name} ({emp.employee_code})
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={
                payslip.status === "published" || payslip.status === "locked"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                  : "bg-amber-500/10 text-amber-600 border-amber-300"
              }
            >
              {payslip.status.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        {/* Printable Payslip Card */}
        <div className="border rounded-lg p-6 bg-card text-card-foreground shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-8 w-auto" />
              <div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">
                  {organizationName}
                </h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Salary Slip for {monthName} {payslip.year}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground">
              <div>Reference: <span className="font-mono text-foreground font-semibold">PAY-{payslip.year}-{String(payslip.month).padStart(2, '0')}-{emp.employee_code}</span></div>
              <div>Mode: <span className="text-foreground capitalize">{payslip.payment_method || "Bank Transfer"}</span></div>
            </div>
          </div>

          {/* Employee & Attendance Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/20 border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Employee Name</span>
              <span className="font-semibold text-foreground">{emp.full_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Employee ID</span>
              <span className="font-mono font-semibold text-foreground">{emp.employee_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Department</span>
              <span className="font-semibold text-foreground">{emp.department?.name || "General"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Designation</span>
              <span className="font-semibold text-foreground">{emp.designation || "Staff"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Working Days</span>
              <span className="font-semibold text-foreground">{payslip.working_days || 30} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Days Worked (Paid)</span>
              <span className="font-semibold text-foreground">{payslip.present_days || 30} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Approved Leaves</span>
              <span className="font-semibold text-foreground">{payslip.leave_days || 0} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Loss of Pay (LOP)</span>
              <span className="font-semibold text-rose-600">{payslip.lop_days || 0} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Bank Name</span>
              <span className="font-semibold text-foreground">{payslip.bank_name || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Account Number</span>
              <span className="font-mono font-semibold text-foreground">{payslip.account_number || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">PAN Number</span>
              <span className="font-mono font-semibold text-foreground">{payslip.pan_number || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">EPF UAN Number</span>
              <span className="font-mono font-semibold text-foreground">{payslip.uan_number || "N/A"}</span>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b font-bold text-xs flex justify-between">
                <span>Earnings Description</span>
                <span>Amount (₹)</span>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-border/40">
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span className="font-medium">{formatINR(payslip.basic_salary)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                  <span className="font-medium">{formatINR(payslip.hra)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Special Allowance</span>
                  <span className="font-medium">{formatINR(payslip.special_allowance)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Conveyance Allowance</span>
                  <span className="font-medium">{formatINR(payslip.conveyance_allowance)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Medical Allowance</span>
                  <span className="font-medium">{formatINR(payslip.medical_allowance)}</span>
                </div>
                {payslip.other_allowances > 0 && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Other Allowances</span>
                    <span className="font-medium">{formatINR(payslip.other_allowances)}</span>
                  </div>
                )}
                {payslip.bonus > 0 && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Bonus / Incentives</span>
                    <span className="font-medium">{formatINR(payslip.bonus)}</span>
                  </div>
                )}
                {payslip.overtime_pay > 0 && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Overtime ({payslip.overtime_hours} hrs)</span>
                    <span className="font-medium">{formatINR(payslip.overtime_pay)}</span>
                  </div>
                )}
              </div>
              <div className="bg-muted/20 px-3 py-2 border-t font-bold text-xs flex justify-between">
                <span>Gross Earnings</span>
                <span className="text-primary">{formatINR(payslip.gross_salary)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b font-bold text-xs flex justify-between">
                <span>Deductions Description</span>
                <span>Amount (₹)</span>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-border/40">
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Provident Fund (EPF)</span>
                  <span className="font-medium">{formatINR(payslip.pf_employee)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Employee State Insurance (ESI)</span>
                  <span className="font-medium">{formatINR(payslip.esi_employee)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Professional Tax (PT)</span>
                  <span className="font-medium">{formatINR(payslip.professional_tax)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">TDS / Income Tax</span>
                  <span className="font-medium">{formatINR(payslip.tds)}</span>
                </div>
                {payslip.lop_deduction > 0 && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Loss of Pay ({payslip.lop_days} days)</span>
                    <span className="font-medium text-rose-600">{formatINR(payslip.lop_deduction)}</span>
                  </div>
                )}
                {payslip.other_deductions > 0 && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Other Deductions</span>
                    <span className="font-medium">{formatINR(payslip.other_deductions)}</span>
                  </div>
                )}
              </div>
              <div className="bg-muted/20 px-3 py-2 border-t font-bold text-xs flex justify-between">
                <span>Total Deductions</span>
                <span className="text-rose-600">{formatINR(payslip.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Salary Callout */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Net Take-Home Salary
              </span>
              <p className="text-xs text-muted-foreground italic mt-0.5">
                {numberToWordsIndian(payslip.net_salary)}
              </p>
            </div>
            <div className="text-2xl font-black text-primary tracking-tight">
              {formatINR(payslip.net_salary)}
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button type="button" size="sm" onClick={handleDownloadPDF} className="gap-1.5">
            <Download className="h-4 w-4" /> Download Official PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
