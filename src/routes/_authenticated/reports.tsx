import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  Clock,
  UserCheck,
  UserX,
  Building2,
  PieChart,
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
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  toDateKey,
  formatDate,
  formatHours,
  totalHours,
  exportCsv,
  printTable,
} from "@/lib/attendance";
import { generateAndBackupPdf } from "@/lib/pdf-backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — FaceTime Attendance" },
      { name: "description", content: "Attendance trends, punctuality metrics, and department breakdowns." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const session = useSession();
  const todayKey = toDateKey(new Date());

  const [rangePreset, setRangePreset] = useState("30"); // 7, 14, 30, 90
  const [selectedDept, setSelectedDept] = useState("all");

  // Query People
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["reports-people", session.department],
    queryFn: async () => {
      let q = supabase.from("people").select("*").eq("active", true).order("name");
      if (session.isManager && session.department) {
        q = q.eq("department", session.department);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const departments = Array.from(new Set(people.map((p) => p.department || "General"))).sort();

  // Query Attendance for Date Range
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["reports-records", rangePreset, session.department],
    queryFn: async () => {
      const days = parseInt(rangePreset, 10);
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      const startKey = toDateKey(d);

      let q = supabase
        .from("attendance")
        .select("*, people!inner(*)")
        .gte("date", startKey)
        .lte("date", todayKey)
        .order("date", { ascending: true });

      if (session.isManager && session.department) {
        q = q.eq("people.department", session.department);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filter by selected department
  const filteredRecords = useMemo(() => {
    if (selectedDept === "all") return records;
    return records.filter((r) => r.people?.department === selectedDept);
  }, [records, selectedDept]);

  const filteredPeople = useMemo(() => {
    if (selectedDept === "all") return people;
    return people.filter((p) => p.department === selectedDept);
  }, [people, selectedDept]);

  // Aggregate KPI metrics
  const kpis = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const presentRecords = filteredRecords.filter((r) => r.status === "present").length;
    const lateRecords = filteredRecords.filter((r) => r.status === "late").length;
    const halfDayRecords = filteredRecords.filter((r) => r.status === "half_day").length;
    const attended = presentRecords + lateRecords + halfDayRecords;

    // Working hours sum
    let totalWorkHours = 0;
    let recordsWithHours = 0;
    for (const r of filteredRecords) {
      const h = totalHours(r.check_in, r.check_out);
      if (h !== null) {
        totalWorkHours += h;
        recordsWithHours++;
      }
    }
    const avgDailyHours = recordsWithHours > 0 ? (totalWorkHours / recordsWithHours).toFixed(1) : "—";
    const punctuality = attended > 0 ? Math.round((presentRecords / attended) * 100) : 0;

    return {
      totalRecords,
      presentRecords,
      lateRecords,
      attended,
      punctuality,
      avgDailyHours,
    };
  }, [filteredRecords]);

  // Daily Trend Chart Data
  const dailyTrend = useMemo(() => {
    const days = parseInt(rangePreset, 10);
    const map: Record<string, { date: string; displayDate: string; present: number; late: number; half_day: number }> =
      {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      map[key] = {
        date: key,
        displayDate: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        present: 0,
        late: 0,
        half_day: 0,
      };
    }

    for (const r of filteredRecords) {
      if (map[r.date]) {
        if (r.status === "present") map[r.date]!.present++;
        else if (r.status === "late") map[r.date]!.late++;
        else if (r.status === "half_day") map[r.date]!.half_day++;
      }
    }

    return Object.values(map);
  }, [filteredRecords, rangePreset]);

  // Department Comparison Data
  const departmentChart = useMemo(() => {
    const deptMap: Record<string, { department: string; present: number; late: number }> = {};
    for (const d of departments) {
      deptMap[d] = { department: d, present: 0, late: 0 };
    }

    for (const r of records) {
      const dept = r.people?.department || "General";
      if (!deptMap[dept]) deptMap[dept] = { department: dept, present: 0, late: 0 };
      if (r.status === "present") deptMap[dept]!.present++;
      else if (r.status === "late") deptMap[dept]!.late++;
    }

    return Object.values(deptMap);
  }, [records, departments]);

  // Employee Summary Table Aggregations
  const employeeSummaries = useMemo(() => {
    const summaries: Record<
      string,
      {
        id: string;
        name: string;
        person_code: string;
        department: string;
        photo_url: string | null;
        present: number;
        late: number;
        half_day: number;
        absent: number;
        totalHours: number;
      }
    > = {};

    for (const p of filteredPeople) {
      summaries[p.id] = {
        id: p.id,
        name: p.name,
        person_code: p.person_code,
        department: p.department || "General",
        photo_url: p.photo_url,
        present: 0,
        late: 0,
        half_day: 0,
        absent: 0,
        totalHours: 0,
      };
    }

    for (const r of filteredRecords) {
      const s = summaries[r.person_id];
      if (s) {
        if (r.status === "present") s.present++;
        else if (r.status === "late") s.late++;
        else if (r.status === "half_day") s.half_day++;
        else if (r.status === "absent") s.absent++;

        const h = totalHours(r.check_in, r.check_out);
        if (h !== null) s.totalHours += h;
      }
    }

    return Object.values(summaries).sort((a, b) => b.present - a.present);
  }, [filteredPeople, filteredRecords]);

  // Export handlers
  function handleExportCsv() {
    const headers = [
      "Name",
      "Personnel Code",
      "Department",
      "Present Days",
      "Late Days",
      "Half Days",
      "Total Working Hours",
    ];

    const rows = employeeSummaries.map((s) => [
      s.name,
      s.person_code,
      s.department,
      s.present,
      s.late,
      s.half_day,
      Math.round(s.totalHours * 10) / 10,
    ]);

    exportCsv(`attendance-report-${rangePreset}days.csv`, headers, rows);
    toast.success("Report exported to CSV");
  }

  function handlePrint() {
    const headers = [
      "Name",
      "Code",
      "Department",
      "Present",
      "Late",
      "Half Day",
      "Total Hours",
    ];

    const rows = employeeSummaries.map((s) => [
      s.name,
      s.person_code,
      s.department,
      s.present,
      s.late,
      s.half_day,
      `${Math.round(s.totalHours * 10) / 10}h`,
    ]);

    printTable(`Attendance Summary Report (${rangePreset} Days)`, headers, rows);
  }

  async function handleExportPdf() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fileName = `report_monthly_${ym}.pdf`;

    const headers = [
      "Name",
      "Code",
      "Department",
      "Present",
      "Late",
      "Half Day",
      "Total Hours",
    ];

    const rows = employeeSummaries.map((s) => [
      s.name,
      s.person_code,
      s.department,
      s.present,
      s.late,
      s.half_day,
      `${Math.round(s.totalHours * 10) / 10}h`,
    ]);

    toast.info("Generating Monthly PDF Report & syncing to Google Drive...");
    await generateAndBackupPdf({
      title: "FaceTime Attendance - Monthly Summary Report",
      subtitle: `Aggregated Performance Summary (${rangePreset} Days) • Period: ${ym}`,
      fileName,
      fileType: "report",
      periodStart: `${ym}-01`,
      periodEnd: toDateKey(),
      headers,
      rows,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Analytics & Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate attendance trends, punctuality scores, and department comparisons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2 text-primary border-primary/30 hover:bg-primary/5">
            <Download className="h-4 w-4" />
            Export Monthly PDF & Backup
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 card-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Time Horizon:</span>
          <div className="flex rounded-lg bg-secondary p-1">
            <Button
              size="sm"
              variant={rangePreset === "7" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setRangePreset("7")}
            >
              7 Days
            </Button>
            <Button
              size="sm"
              variant={rangePreset === "14" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setRangePreset("14")}
            >
              14 Days
            </Button>
            <Button
              size="sm"
              variant={rangePreset === "30" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setRangePreset("30")}
            >
              30 Days
            </Button>
            <Button
              size="sm"
              variant={rangePreset === "90" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setRangePreset("90")}
            >
              90 Days
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Logged Attendance
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div>
                <span className="text-2xl font-bold">{kpis.attended}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check-ins across selected period
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Punctuality Score</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/15 text-success">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div>
                <span className="text-2xl font-bold text-success">{kpis.punctuality}%</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kpis.presentRecords} on-time vs {kpis.lateRecords} late arrivals
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg Daily Hours Logged
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div>
                <span className="text-2xl font-bold">{kpis.avgDailyHours} hrs</span>
                <p className="mt-1 text-xs text-muted-foreground">Per employee per active shift</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Late Incidents</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <UserX className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div>
                <span className="text-2xl font-bold text-destructive">{kpis.lateRecords}</span>
                <p className="mt-1 text-xs text-muted-foreground">Exceeded shift start grace time</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Attendance Volume Over Time */}
        <Card className="card-soft lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Attendance Trend Over Time</CardTitle>
            <CardDescription>
              Volume of on-time present vs late check-ins per day
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.63 0.17 155)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="oklch(0.63 0.17 155)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.75 0.16 75)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="oklch(0.75 0.16 75)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="Present"
                      stroke="oklch(0.63 0.17 155)"
                      fillOpacity={1}
                      fill="url(#presentGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="Late"
                      stroke="oklch(0.75 0.16 75)"
                      fillOpacity={1}
                      fill="url(#lateGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Volume Comparison */}
        <Card className="card-soft lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Department Breakdown</CardTitle>
            <CardDescription>Attendance distribution across departments</CardDescription>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : departmentChart.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">
                No department records available.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChart}
                    layout="vertical"
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="department" type="category" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="present" name="Present" fill="oklch(0.512 0.218 276.9)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personnel Summary Report Table */}
      <Card className="card-soft overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Personnel Attendance Summary</CardTitle>
          <CardDescription>
            Performance breakdown per enrolled person over the selected {rangePreset}-day window.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {peopleLoading || recordsLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : employeeSummaries.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">No personnel records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Personnel</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-center">Present Days</th>
                    <th className="px-4 py-3 text-center">Late Days</th>
                    <th className="px-4 py-3 text-center">Half Days</th>
                    <th className="px-4 py-3 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {employeeSummaries.map((s) => {
                    const initials = s.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={s.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {s.photo_url ? (
                              <img
                                src={s.photo_url}
                                alt={s.name}
                                className="h-7 w-7 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {initials}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-foreground">{s.name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {s.person_code}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{s.department}</td>

                        <td className="px-4 py-3 text-center font-semibold text-success">
                          {s.present}
                        </td>

                        <td className="px-4 py-3 text-center font-semibold text-warning-foreground">
                          {s.late}
                        </td>

                        <td className="px-4 py-3 text-center text-muted-foreground">{s.half_day}</td>

                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                          {Math.round(s.totalHours * 10) / 10}h
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
    </div>
  );
}

