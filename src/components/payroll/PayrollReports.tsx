import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, BarChart3, ShieldCheck, Landmark } from "lucide-react";
import { formatINR, MONTH_NAMES, PayslipItem } from "@/lib/payroll";

interface PayrollReportsProps {
  organizationId: string;
}

export function PayrollReports({ organizationId }: PayrollReportsProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["payroll-report-payslips", organizationId, selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          *,
          employee:employees!payslips_employee_id_fkey(
            id,
            full_name,
            employee_code,
            designation,
            department:departments(name)
          )
        `)
        .eq("organization_id", organizationId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      return ((data || []) as unknown) as PayslipItem[];
    },
    enabled: !!organizationId,
  });

  // Aggregates
  const totalEmployees = payslips.length;
  const totalGross = payslips.reduce((sum, p) => sum + Number(p.gross_salary || 0), 0);
  const totalNet = payslips.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);
  const totalDeductions = payslips.reduce((sum, p) => sum + Number(p.total_deductions || 0), 0);

  const totalPfEmployee = payslips.reduce((sum, p) => sum + Number(p.pf_employee || 0), 0);
  const totalPfEmployer = payslips.reduce((sum, p) => sum + Number(p.pf_employer || 0), 0);
  const totalEsiEmployee = payslips.reduce((sum, p) => sum + Number(p.esi_employee || 0), 0);
  const totalEsiEmployer = payslips.reduce((sum, p) => sum + Number(p.esi_employer || 0), 0);
  const totalPT = payslips.reduce((sum, p) => sum + Number(p.professional_tax || 0), 0);
  const totalTDS = payslips.reduce((sum, p) => sum + Number(p.tds || 0), 0);

  function exportRegisterCSV() {
    if (!payslips.length) return;
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Designation",
      "Basic",
      "HRA",
      "Special Allowance",
      "Allowances",
      "Gross Earnings",
      "EPF Employee",
      "ESI Employee",
      "Professional Tax",
      "TDS",
      "LOP Days",
      "LOP Deductions",
      "Total Deductions",
      "Net Salary",
      "Bank Name",
      "Account Number",
      "PAN Number",
      "Status",
    ];

    const rows = payslips.map((p) => [
      `"${p.employee?.employee_code || ""}"`,
      `"${p.employee?.full_name || ""}"`,
      `"${p.employee?.department?.name || "General"}"`,
      `"${p.employee?.designation || ""}"`,
      p.basic_salary,
      p.hra,
      p.special_allowance,
      p.allowances,
      p.gross_salary,
      p.pf_employee,
      p.esi_employee,
      p.professional_tax,
      p.tds,
      p.lop_days,
      p.lop_deduction,
      p.total_deductions,
      p.net_salary,
      `"${p.bank_name || ""}"`,
      `"${p.account_number || ""}"`,
      `"${p.pan_number || ""}"`,
      `"${p.status}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Payroll_Register_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Month Filter & Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(Number(val))}
          >
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={name} value={String(idx + 1)} className="text-xs">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-28 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((yr) => (
                <SelectItem key={yr} value={String(yr)} className="text-xs">
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportRegisterCSV}
          disabled={!payslips.length}
          className="gap-1.5 text-xs"
        >
          <Download className="h-4 w-4" /> Export Register CSV
        </Button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Total Gross Payout</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {formatINR(totalGross)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across {totalEmployees} active employees
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Net Take-Home</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {formatINR(totalNet)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Disbursed to employee bank accounts
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Total Statutory EPF</CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600">
              {formatINR(totalPfEmployee + totalPfEmployer)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex justify-between">
            <span>Employee: {formatINR(totalPfEmployee)}</span>
            <span>Employer: {formatINR(totalPfEmployer)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">State Taxes & TDS</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {formatINR(totalPT + totalTDS)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex justify-between">
            <span>PT: {formatINR(totalPT)}</span>
            <span>TDS: {formatINR(totalTDS)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Statutory Breakdown Summary Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Indian Statutory Deductions Summary
          </CardTitle>
          <CardDescription className="text-xs">
            Summary of Employee Provident Fund, ESI, Professional Tax, and Income Tax deductions for remittance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">EPF (Employee + Employer)</span>
              <p className="text-lg font-bold text-foreground">{formatINR(totalPfEmployee + totalPfEmployer)}</p>
              <p className="text-[11px] text-muted-foreground">Combined 24% statutory contribution</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">ESI (Health Insurance)</span>
              <p className="text-lg font-bold text-foreground">{formatINR(totalEsiEmployee + totalEsiEmployer)}</p>
              <p className="text-[11px] text-muted-foreground">Employee 0.75% + Employer 3.25%</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Professional Tax (PT)</span>
              <p className="text-lg font-bold text-foreground">{formatINR(totalPT)}</p>
              <p className="text-[11px] text-muted-foreground">State government levy</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">TDS / Income Tax</span>
              <p className="text-lg font-bold text-foreground">{formatINR(totalTDS)}</p>
              <p className="text-[11px] text-muted-foreground">Withholding tax for Form 24Q</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Register Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Monthly Payroll Register
          </CardTitle>
          <CardDescription className="text-xs">
            Complete line-item compensation records for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading register...</div>
          ) : payslips.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No payslips found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}. Run payroll calculation to generate records.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-2.5 font-semibold">Employee</th>
                    <th className="p-2.5 font-semibold">Department</th>
                    <th className="p-2.5 font-semibold text-right">Basic (₹)</th>
                    <th className="p-2.5 font-semibold text-right">HRA (₹)</th>
                    <th className="p-2.5 font-semibold text-right">Allowances</th>
                    <th className="p-2.5 font-semibold text-right">Gross (₹)</th>
                    <th className="p-2.5 font-semibold text-right">EPF (₹)</th>
                    <th className="p-2.5 font-semibold text-right">PT (₹)</th>
                    <th className="p-2.5 font-semibold text-right">LOP (₹)</th>
                    <th className="p-2.5 font-semibold text-right">Total Ded.</th>
                    <th className="p-2.5 font-semibold text-right">Net Take-Home</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="p-2.5">
                        <div className="font-semibold text-foreground">{p.employee?.full_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{p.employee?.employee_code}</div>
                      </td>
                      <td className="p-2.5 text-muted-foreground">{p.employee?.department?.name || "General"}</td>
                      <td className="p-2.5 text-right">{formatINR(p.basic_salary)}</td>
                      <td className="p-2.5 text-right">{formatINR(p.hra)}</td>
                      <td className="p-2.5 text-right">{formatINR(p.allowances)}</td>
                      <td className="p-2.5 text-right font-semibold text-foreground">{formatINR(p.gross_salary)}</td>
                      <td className="p-2.5 text-right text-amber-600">{formatINR(p.pf_employee)}</td>
                      <td className="p-2.5 text-right text-amber-600">{formatINR(p.professional_tax)}</td>
                      <td className="p-2.5 text-right text-rose-600">{formatINR(p.lop_deduction)}</td>
                      <td className="p-2.5 text-right text-rose-600 font-semibold">{formatINR(p.total_deductions)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">{formatINR(p.net_salary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
