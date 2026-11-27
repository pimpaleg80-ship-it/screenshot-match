import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  UserPlus,
  Clock,
  CalendarRange,
  Briefcase,
  Target,
  Receipt,
  Calculator,
  LifeBuoy,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReportsAnalyticsOverview,
  DatePresetKey,
  getDatePresetRange,
  calculatePunctualityScore,
  calculateRecruitmentConversionRate,
  calculateTicketResolutionRate,
  exportOverviewToCsv,
  exportExecutivePdfReport,
} from "@/lib/reports";
import { formatDate } from "@/lib/attendance";

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
];

export function ReportsHub() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<DatePresetKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [activeTab, setActiveTab] = useState("workforce");

  // Determine effective date range
  const { startDate, endDate, label: periodLabel } = useMemo(() => {
    return getDatePresetRange(preset, customStart, customEnd);
  }, [preset, customStart, customEnd]);

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["reports-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) return [];
      return data || [];
    },
  });

  // Fetch Main Reports Overview RPC
  const {
    data: overview,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ReportsAnalyticsOverview>({
    queryKey: [
      "reports-overview",
      session.organizationId,
      startDate,
      endDate,
      selectedDeptId,
    ],
    queryFn: async () => {
      if (!session.organizationId) {
        throw new Error("Organization ID is required");
      }

      const deptArg = selectedDeptId === "all" ? null : selectedDeptId;

      const { data, error } = await supabase.rpc("get_reports_analytics_overview", {
        _organization_id: session.organizationId,
        _start_date: startDate,
        _end_date: endDate,
        _department_id: deptArg,
      });

      if (error) throw error;
      return data as unknown as ReportsAnalyticsOverview;
    },
    enabled: !!session.organizationId,
  });

  // Quick KPI calculations
  const punctualityScore = useMemo(() => {
    if (!overview) return 100;
    return calculatePunctualityScore(
      overview.attendance.present_count,
      overview.attendance.late_count
    );
  }, [overview]);

  const ticketResolutionRate = useMemo(() => {
    if (!overview) return 100;
    return calculateTicketResolutionRate(
      overview.tickets.resolved_tickets,
      overview.tickets.total_tickets
    );
  }, [overview]);

  // Filtered new hires by search
  const filteredNewHires = useMemo(() => {
    if (!overview) return [];
    if (!employeeSearch.trim()) return overview.new_hires;
    const term = employeeSearch.toLowerCase();
    return overview.new_hires.filter(
      (h) =>
        h.full_name.toLowerCase().includes(term) ||
        h.employee_code.toLowerCase().includes(term) ||
        (h.designation && h.designation.toLowerCase().includes(term))
    );
  }, [overview, employeeSearch]);

  // Export handlers
  function handleExportCsv() {
    if (!overview) {
      toast.error("No report data available to export");
      return;
    }
    exportOverviewToCsv(overview, periodLabel);
    toast.success("CSV report exported successfully");
  }

  function handleExportPdf() {
    if (!overview) {
      toast.error("No report data available to export");
      return;
    }
    toast.info("Generating Executive PDF Report...");
    exportExecutivePdfReport(overview, periodLabel, "FlowPeople Organization");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Reports & Executive Analytics
            </h1>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary text-xs"
            >
              15 Report Modules
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Workforce intelligence, attendance trends, recruitment pipeline, financial
            deductions, and SLA statistics across {periodLabel}.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            className="h-9 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs hidden sm:inline-flex"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <Card className="p-3.5 sm:p-4 bg-card/60 backdrop-blur border shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Horizon:
            </span>
            {(
              [
                { key: "7d", label: "7D" },
                { key: "30d", label: "30D" },
                { key: "90d", label: "90D" },
                { key: "this_month", label: "This Month" },
                { key: "last_month", label: "Last Month" },
                { key: "this_year", label: "This Year" },
                { key: "custom", label: "Custom" },
              ] as const
            ).map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={preset === item.key ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setPreset(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {/* Department and Custom Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {preset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs w-32"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs w-32"
                />
              </div>
            )}

            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="h-8 text-xs w-[170px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Top Level Metric Scorecard (6 Pillars) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Headcount */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Active Workforce</span>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold">{overview?.headcount.active_count ?? 0}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                of {overview?.headcount.total_employees ?? 0} total on roll
              </p>
            </div>
          )}
        </Card>

        {/* Punctuality */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Punctuality Score</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {punctualityScore}%
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {overview?.attendance.late_count ?? 0} late arrivals
              </p>
            </div>
          )}
        </Card>

        {/* Overtime */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Total Overtime</span>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold">
                {overview?.attendance.total_overtime_hours ?? 0} hrs
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">across shifts</p>
            </div>
          )}
        </Card>

        {/* Approved Leaves */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Approved Leaves</span>
            <CalendarRange className="h-3.5 w-3.5 text-cyan-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold">
                {overview?.leaves.total_approved_days ?? 0} days
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                CL, SL, EL combined
              </p>
            </div>
          )}
        </Card>

        {/* Helpdesk Resolution */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Ticket SLA</span>
            <LifeBuoy className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold">{ticketResolutionRate}%</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {overview?.tickets.resolved_tickets ?? 0} resolved of{" "}
                {overview?.tickets.total_tickets ?? 0}
              </p>
            </div>
          )}
        </Card>

        {/* Performance Score */}
        <Card className="p-3.5 bg-card">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Avg Performance</span>
            <Target className="h-3.5 w-3.5 text-rose-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <div>
              <span className="text-xl font-bold">
                {overview?.performance.avg_rating ?? 0} / 5.0
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {overview?.performance.completed_reviews ?? 0} reviews completed
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Domain Specific Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/60">
          <TabsTrigger value="workforce" className="text-xs py-2 gap-1.5">
            <Users className="h-3.5 w-3.5" /> Workforce
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs py-2 gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Attendance & Shift
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs py-2 gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Leaves
          </TabsTrigger>
          <TabsTrigger value="recruitment" className="text-xs py-2 gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Recruitment
          </TabsTrigger>
          <TabsTrigger value="finance" className="text-xs py-2 gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> Payroll & Expenses
          </TabsTrigger>
          <TabsTrigger value="operations" className="text-xs py-2 gap-1.5">
            <LifeBuoy className="h-3.5 w-3.5" /> Operations & SLA
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: WORKFORCE & HEADCOUNT */}
        <TabsContent value="workforce" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Department Breakdown BarChart */}
            <Card className="lg:col-span-7">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Department-Wise Headcount Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Active staff headcount grouped by organizational department
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : !overview?.department_distribution.length ? (
                  <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                    No department data available.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={overview.department_distribution}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="headcount"
                          name="Headcount"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workforce Status Distribution Pie */}
            <Card className="lg:col-span-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Employment Status Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Active, Probation, Notice period and Inactive status ratios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Active", value: overview?.headcount.active_count ?? 0 },
                            { name: "Probation", value: overview?.headcount.probation_count ?? 0 },
                            { name: "Notice Period", value: overview?.headcount.notice_count ?? 0 },
                            { name: "Inactive", value: overview?.headcount.inactive_count ?? 0 },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {COLORS.map((c, i) => (
                            <Cell key={`cell-${i}`} fill={c} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* New Hires Table */}
          <div className="grid gap-4">
            {/* New Hires */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-emerald-500" />
                      New Employees Joined ({overview?.new_hires.length ?? 0})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Employees joined during this period
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {periodLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!filteredNewHires.length ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No new employee joins recorded in this date range.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b bg-muted/30 text-muted-foreground font-medium">
                        <tr>
                          <th className="p-2.5 pl-4">Employee</th>
                          <th className="p-2.5">Designation</th>
                          <th className="p-2.5 pr-4 text-right">Joining Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredNewHires.map((h) => (
                          <tr key={h.id} className="hover:bg-muted/10">
                            <td className="p-2.5 pl-4 font-medium">
                              <div>{h.full_name}</div>
                              <span className="text-[10px] text-muted-foreground">
                                {h.employee_code}
                              </span>
                            </td>
                            <td className="p-2.5 text-muted-foreground">
                              {h.designation || "General"}
                            </td>
                            <td className="p-2.5 pr-4 text-right text-muted-foreground">
                              {formatDate(h.joining_date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: ATTENDANCE & SHIFTS */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Attendance Status Summary */}
            <Card className="lg:col-span-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Attendance Volume Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Summary of on-time presents, late arrivals, half-days, and overtime recorded
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          category: "Attendance",
                          Present: overview?.attendance.present_count ?? 0,
                          Late: overview?.attendance.late_count ?? 0,
                          HalfDay: overview?.attendance.half_day_count ?? 0,
                          Absent: overview?.attendance.absent_count ?? 0,
                          OnLeave: overview?.attendance.leave_count ?? 0,
                        },
                      ]}
                      margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="HalfDay" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="OnLeave" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Shift Roster Allocation */}
            <Card className="lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-500" />
                  Shift Roster Allocation
                </CardTitle>
                <CardDescription className="text-xs">
                  Active staff distribution across designated shifts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!overview?.shifts.length ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No active shift rosters configured.
                  </p>
                ) : (
                  <div className="divide-y text-xs">
                    {overview.shifts.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 hover:bg-muted/10"
                      >
                        <span className="font-medium text-foreground">{s.shift_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {s.assigned_employees} staff
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: LEAVES & UTILIZATION */}
        <TabsContent value="leaves" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 bg-card">
              <h4 className="text-xs font-semibold text-muted-foreground">Casual Leave (CL)</h4>
              <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {overview?.leaves.casual_leave ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Approved requests</p>
            </Card>

            <Card className="p-4 bg-card">
              <h4 className="text-xs font-semibold text-muted-foreground">Sick Leave (SL)</h4>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {overview?.leaves.sick_leave ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Approved requests</p>
            </Card>

            <Card className="p-4 bg-card">
              <h4 className="text-xs font-semibold text-muted-foreground">Earned Leave (EL)</h4>
              <p className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                {overview?.leaves.earned_leave ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Approved requests</p>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-primary" />
                Total Leave Consumption: {overview?.leaves.total_approved_days ?? 0} Days
              </CardTitle>
              <CardDescription className="text-xs">
                Organization-wide leave consumption across the reporting window
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Casual Leave",
                        requests: overview?.leaves.casual_leave ?? 0,
                      },
                      {
                        name: "Sick Leave",
                        requests: overview?.leaves.sick_leave ?? 0,
                      },
                      {
                        name: "Earned Leave",
                        requests: overview?.leaves.earned_leave ?? 0,
                      },
                    ]}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: RECRUITMENT PIPELINE */}
        <TabsContent value="recruitment" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-500" />
                    Talent Acquisition Funnel Stages
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Candidate conversion from initial application through final hire
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                  {overview
                    ? calculateRecruitmentConversionRate(
                        overview.recruitment.hired,
                        overview.recruitment.applied
                      )
                    : 0}
                  % Conversion Rate
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { stage: "Applied", count: overview?.recruitment.applied ?? 0 },
                      { stage: "Screening", count: overview?.recruitment.screening ?? 0 },
                      { stage: "Shortlisted", count: overview?.recruitment.shortlisted ?? 0 },
                      { stage: "Interview", count: overview?.recruitment.interview ?? 0 },
                      { stage: "Selected", count: overview?.recruitment.selected ?? 0 },
                      { stage: "Offer", count: overview?.recruitment.offer ?? 0 },
                      { stage: "Hired", count: overview?.recruitment.hired ?? 0 },
                      { stage: "Rejected", count: overview?.recruitment.rejected ?? 0 },
                    ]}
                    margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" name="Candidates" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: FINANCE & PAYROLL */}
        <TabsContent value="finance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Payroll Summaries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  Monthly Payroll Disbursals
                </CardTitle>
                <CardDescription className="text-xs">
                  Gross wages, net payouts, and statutory compliance deductions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Gross Salary</span>
                    <span className="text-lg font-bold text-foreground">
                      ₹{(overview?.payroll.total_gross ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Net Disbursed</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{(overview?.payroll.total_net ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-3 divide-y text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Provident Fund (PF):</span>
                    <span className="font-semibold">₹{(overview?.payroll.total_pf ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Professional Tax (PT):</span>
                    <span className="font-semibold">₹{(overview?.payroll.total_pt ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">TDS Tax:</span>
                    <span className="font-semibold">₹{(overview?.payroll.total_tds ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Processed Payroll Runs:</span>
                    <span className="font-semibold">{overview?.payroll.runs_count ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expenses Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-500" />
                  Employee Expense Reimbursements
                </CardTitle>
                <CardDescription className="text-xs">
                  Submitted travel, food, and miscellaneous claim settlements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Total Claimed</span>
                    <span className="text-lg font-bold text-foreground">
                      ₹{(overview?.expenses.total_amount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Approved / Paid</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{(overview?.expenses.approved_amount ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-3 divide-y text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Travel Expenses:</span>
                    <span className="font-semibold">₹{(overview?.expenses.travel_amount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Food Expenses:</span>
                    <span className="font-semibold">₹{(overview?.expenses.food_amount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Total Claims Filed:</span>
                    <span className="font-semibold">{overview?.expenses.claims_count ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 6: OPERATIONS & SLA */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4">
            {/* HR Helpdesk Tickets */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4 text-indigo-500" />
                    HR Support Tickets & SLA
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {ticketResolutionRate}% Resolved
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Query resolution speed and topic distributions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Open / In Progress</span>
                    <span className="text-lg font-bold text-amber-600">
                      {overview?.tickets.open_tickets ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Resolved / Closed</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {overview?.tickets.resolved_tickets ?? 0}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-3 divide-y text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Attendance Queries:</span>
                    <span className="font-semibold">{overview?.tickets.attendance_queries ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Leave Queries:</span>
                    <span className="font-semibold">{overview?.tickets.leave_queries ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Payroll Queries:</span>
                    <span className="font-semibold">{overview?.tickets.payroll_queries ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
