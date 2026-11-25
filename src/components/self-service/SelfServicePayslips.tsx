import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Download,
  Eye,
  Printer,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/brand-logo";
import {
  PayslipItem,
  MONTH_NAMES,
  formatINR,
  numberToWordsIndian,
  generatePayslipPDF,
} from "@/lib/payroll";

interface SelfServicePayslipsProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null | undefined;
  designation?: string | null | undefined;
}

export function SelfServicePayslips({
  employeeId,
  employeeName,
  employeeCode,
  departmentName,
  designation,
}: SelfServicePayslipsProps) {
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);

  // Query my published payslips
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["my-payslips", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "published")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PayslipItem[];
    },
    enabled: !!employeeId,
  });

  function handleDownloadPDF(p: PayslipItem) {
    const doc = generatePayslipPDF({
      payslip: p,
      employee: {
        full_name: employeeName,
        employee_code: employeeCode,
        designation: designation,
        department_name: departmentName,
        bank_name: p.bank_name,
        account_number: p.account_number,
        pan_number: p.pan_number,
        uan_number: p.uan_number,
      },
    });
    doc.save(`Payslip_${employeeCode}_${MONTH_NAMES[(p.month - 1) % 12]}_${p.year}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> Monthly Salary & Payslips
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect official compensation statements, gross earnings, statutory deductions, and net take-home salary.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {payslips.length} Statements
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : payslips.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <FileSpreadsheet className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="font-semibold text-foreground text-sm">No Published Payslips Yet</p>
              <p className="mt-1 max-w-sm mx-auto">
                Your compensation records and monthly salary slips will appear here as soon as HR finalizes and publishes the payroll run.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Pay Period</th>
                    <th className="py-2.5 px-3 text-right">Gross Salary</th>
                    <th className="py-2.5 px-3 text-right">EPF Deductions</th>
                    <th className="py-2.5 px-3 text-right">Total Deductions</th>
                    <th className="py-2.5 px-3 text-right">Net Take-Home</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Statement</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payslips.map((p) => {
                    const periodLabel = `${MONTH_NAMES[(p.month - 1) % 12]} ${p.year}`;

                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {periodLabel}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {formatINR(p.gross_salary || (Number(p.basic_salary) + Number(p.allowances)))}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-600 font-medium">
                          {formatINR(p.pf_employee || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600 font-medium">
                          {formatINR(p.total_deductions || p.deductions)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-sm text-emerald-600">
                          {formatINR(p.net_salary)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] border-emerald-200">
                            Published
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setSelectedPayslip(p)}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleDownloadPDF(p)}
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslip Breakdown Dialog */}
      {selectedPayslip && (
        <Dialog open={!!selectedPayslip} onOpenChange={(open) => !open && setSelectedPayslip(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between border-b pb-3">
                <BrandLogo className="h-6 w-auto" />
                <Badge variant="outline" className="font-mono text-xs">
                  {MONTH_NAMES[(selectedPayslip.month - 1) % 12]} {selectedPayslip.year}
                </Badge>
              </div>
              <DialogTitle className="text-base pt-2">Official Salary Statement</DialogTitle>
              <DialogDescription className="text-xs">
                Detailed compensation itemization for {employeeName} ({employeeCode}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Employee Meta Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Employee Name</span>
                  <span className="font-semibold text-foreground">{employeeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Employee ID</span>
                  <span className="font-mono font-semibold">{employeeCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Designation</span>
                  <span className="font-medium">{designation || "Staff Member"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Department</span>
                  <span className="font-medium">{departmentName || "General"}</span>
                </div>
              </div>

              {/* Earnings & Deductions Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="rounded-lg border p-3 space-y-2">
                  <h4 className="font-semibold text-xs text-primary flex items-center justify-between border-b pb-1">
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-medium">{formatINR(selectedPayslip.basic_salary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">House Rent (HRA)</span>
                      <span className="font-medium">{formatINR(selectedPayslip.hra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Special Allowance</span>
                      <span className="font-medium">{formatINR(selectedPayslip.special_allowance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conveyance Allowance</span>
                      <span className="font-medium">{formatINR(selectedPayslip.conveyance_allowance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Medical Allowance</span>
                      <span className="font-medium">{formatINR(selectedPayslip.medical_allowance)}</span>
                    </div>
                    {selectedPayslip.overtime_pay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Overtime Pay</span>
                        <span className="font-medium">{formatINR(selectedPayslip.overtime_pay)}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t flex justify-between font-bold text-xs">
                    <span>Gross Earnings</span>
                    <span className="text-primary">
                      {formatINR(selectedPayslip.gross_salary || (Number(selectedPayslip.basic_salary) + Number(selectedPayslip.allowances)))}
                    </span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="rounded-lg border p-3 space-y-2">
                  <h4 className="font-semibold text-xs text-rose-600 flex items-center justify-between border-b pb-1">
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provident Fund (EPF)</span>
                      <span className="font-medium">{formatINR(selectedPayslip.pf_employee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ESI (Health Insurance)</span>
                      <span className="font-medium">{formatINR(selectedPayslip.esi_employee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Professional Tax (PT)</span>
                      <span className="font-medium">{formatINR(selectedPayslip.professional_tax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TDS / Income Tax</span>
                      <span className="font-medium">{formatINR(selectedPayslip.tds)}</span>
                    </div>
                    {selectedPayslip.lop_deduction > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>LOP ({selectedPayslip.lop_days} days)</span>
                        <span className="font-medium">-{formatINR(selectedPayslip.lop_deduction)}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t flex justify-between font-bold text-xs">
                    <span>Total Deductions</span>
                    <span className="text-rose-600">
                      {formatINR(selectedPayslip.total_deductions || selectedPayslip.deductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Pay Banner */}
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase block">Net Take-Home Salary</span>
                  <span className="text-[11px] text-muted-foreground italic">
                    {numberToWordsIndian(selectedPayslip.net_salary)}
                  </span>
                </div>
                <div className="text-2xl font-black text-primary">
                  {formatINR(selectedPayslip.net_salary)}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs h-8"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Statement
              </Button>
              <Button
                size="sm"
                onClick={() => handleDownloadPDF(selectedPayslip)}
                className="gap-1.5 text-xs h-8"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
