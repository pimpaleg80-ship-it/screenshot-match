import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  Download,
  CreditCard,
  DollarSign,
  PieChart,
  Building,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ExpenseClaim,
  calculateMonthlyExpenseSummary,
  formatCurrency,
} from "@/lib/expenses";

export function MonthlyExpenseReports() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    (currentDate.getMonth() + 1).toString().padStart(2, "0")
  );

  // Fetch all claims for analytics
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["expense-claims-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_claims")
        .select(`
          *,
          employee:employees!expense_claims_employee_id_fkey(
            id,
            full_name,
            email,
            department:departments(id, name)
          )
        `)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ExpenseClaim[];
    },
  });

  // Filter claims by selected month and year
  const monthlyClaims = useMemo(() => {
    return claims.filter((c) => {
      if (!c.expense_date) return false;
      const [year, month] = c.expense_date.split("-");
      return year === selectedYear && month === selectedMonth;
    });
  }, [claims, selectedYear, selectedMonth]);

  const summary = useMemo(() => {
    return calculateMonthlyExpenseSummary(monthlyClaims);
  }, [monthlyClaims]);

  // Export to CSV
  const handleExportCsv = () => {
    if (monthlyClaims.length === 0) {
      toast.error("No expense data available to export for the selected month");
      return;
    }

    const headers = [
      "Claim ID",
      "Title",
      "Employee",
      "Department",
      "Category",
      "Expense Date",
      "Amount (INR)",
      "Status",
      "Payment Method",
      "Reference",
    ];

    const rows = monthlyClaims.map((c) => [
      c.id,
      `"${(c.title || "").replace(/"/g, '""')}"`,
      `"${(c.employee?.full_name || "").replace(/"/g, '""')}"`,
      `"${(c.employee?.department?.name || "General").replace(/"/g, '""')}"`,
      `"${(c.category || "").replace(/"/g, '""')}"`,
      c.expense_date,
      c.amount,
      c.status,
      c.payment_method || "",
      c.reimbursement_reference || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `FlowPeople_Expenses_${selectedYear}_${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Monthly expense report exported to CSV");
  };

  const MONTH_NAMES = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  return (
    <div className="space-y-6">
      {/* Month & Year Filter Bar */}
      <Card className="border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Select Month & Year
              </span>
              <div className="flex items-center gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2024", "2025", "2026", "2027"].map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Monthly CSV</span>
          </Button>
        </div>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Claims Filed
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.totalClaimed)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.claimsCount} claims submitted
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved (Pending Payout)
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(summary.totalApproved)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.approvedCount} claims queued
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Disbursed / Reimbursed
            </CardTitle>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalReimbursed)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.reimbursedCount} settled payments
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Review (Pending)
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatCurrency(summary.totalPending)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.pendingCount} claims in review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <span>Spend by Category</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of expenditures across travel, food, accommodation, and custom categories.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {summary.categoryBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                No expense spend recorded for this month.
              </div>
            ) : (
              summary.categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.category}</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(item.amount)}{" "}
                      <span className="text-[11px] text-muted-foreground font-normal">
                        ({Math.round(item.percentage)}%)
                      </span>
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              <span>Spend by Department</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Total expenditure incurred by each organizational team or business unit.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {summary.departmentBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                No department expenses recorded for this month.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {summary.departmentBreakdown.map((dept) => (
                  <div key={dept.department} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{dept.department}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {dept.count} {dept.count === 1 ? "claim" : "claims"}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-foreground">
                      {formatCurrency(dept.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
