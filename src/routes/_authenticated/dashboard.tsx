import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  ScanLine,
  UserPlus,
  ClipboardCheck,
  ArrowUpRight,
  RefreshCw,
  Search,
  Calendar as CalendarIcon,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
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
  formatTime,
  formatDate,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FaceTime Attendance" },
      { name: "description", content: "Real-time attendance overview and analytics." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [feedSearch, setFeedSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [manualDate, setManualDate] = useState(todayKey);
  const [manualCheckIn, setManualCheckIn] = useState("09:00");
  const [manualCheckOut, setManualCheckOut] = useState("17:00");
  const [manualStatus, setManualStatus] = useState("present");
  const [manualReason, setManualReason] = useState("");

  // Query people
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["people", session.department],
    queryFn: async () => {
      let query = supabase.from("people").select("*").eq("active", true).order("name");
      if (session.isManager && session.department) {
        query = query.eq("department", session.department);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query today's attendance
  const {
    data: todayAttendance = [],
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ["attendance-today", todayKey, session.department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, people!inner(*)")
        .eq("date", todayKey)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query 7-day trend
  const { data: trendData = [], isLoading: trendLoading } = useQuery({
    queryKey: ["attendance-trend-7d", session.department],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const startKey = toDateKey(d);

      const { data, error } = await supabase
        .from("attendance")
        .select("date, status")
        .gte("date", startKey)
        .lte("date", todayKey);
      if (error) throw error;

      // Group by date
      const map: Record<string, { date: string; present: number; late: number; absent: number }> =
        {};
      for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const key = toDateKey(day);
        const shortName = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
        map[key] = { date: shortName, present: 0, late: 0, absent: 0 };
      }

      for (const row of data ?? []) {
        if (map[row.date]) {
          if (row.status === "present") map[row.date]!.present++;
          else if (row.status === "late") map[row.date]!.late++;
          else if (row.status === "absent") map[row.date]!.absent++;
        }
      }

      return Object.values(map);
    },
  });

  // Manual attendance mutation
  const markManualMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPersonId) throw new Error("Select a person");
      const checkInIso = manualCheckIn
        ? new Date(`${manualDate}T${manualCheckIn}:00`).toISOString()
        : null;
      const checkOutIso = manualCheckOut
        ? new Date(`${manualDate}T${manualCheckOut}:00`).toISOString()
        : null;

      const { error } = await supabase.from("attendance").upsert(
        {
          person_id: selectedPersonId,
          date: manualDate,
          check_in: checkInIso,
          check_out: checkOutIso,
          status: manualStatus,
          method: "manual",
          edit_reason: manualReason || "Marked manually via dashboard",
          edited_by: session.user?.id ?? null,
        },
        { onConflict: "person_id,date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance record saved successfully");
      setManualOpen(false);
      setSelectedPersonId("");
      setManualReason("");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-trend-7d"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save attendance");
    },
  });

  // KPI Calculations
  const totalPeople = people.length;
  const presentCount = todayAttendance.filter((a) => a.status === "present").length;
  const lateCount = todayAttendance.filter((a) => a.status === "late").length;
  const totalAttended = presentCount + lateCount;
  const absentCount = Math.max(0, totalPeople - totalAttended);
  const attendanceRate = totalPeople > 0 ? Math.round((totalAttended / totalPeople) * 100) : 0;
  const punctualityRate = totalAttended > 0 ? Math.round((presentCount / totalAttended) * 100) : 0;

  // Filter feed
  const filteredFeed = useMemo(() => {
    if (!feedSearch.trim()) return todayAttendance;
    const q = feedSearch.toLowerCase();
    return todayAttendance.filter(
      (item) =>
        item.people?.name?.toLowerCase().includes(q) ||
        item.people?.person_code?.toLowerCase().includes(q) ||
        item.people?.department?.toLowerCase().includes(q),
    );
  }, [todayAttendance, feedSearch]);

  // Department distribution
  const departmentStats = useMemo(() => {
    const counts: Record<string, { total: number; attended: number }> = {};
    for (const p of people) {
      const dept = p.department || "General";
      if (!counts[dept]) counts[dept] = { total: 0, attended: 0 };
      counts[dept].total++;
    }
    for (const a of todayAttendance) {
      const dept = a.people?.department || "General";
      if (counts[dept]) counts[dept].attended++;
    }
    return Object.entries(counts).map(([dept, data]) => ({
      department: dept,
      rate: data.total > 0 ? Math.round((data.attended / data.total) * 100) : 0,
      attended: data.attended,
      total: data.total,
    }));
  }, [people, todayAttendance]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Attendance Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>Today is {formatDate(new Date())}</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Real-time biometric monitoring</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchToday();
              toast.info("Refreshed attendance feed");
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-primary shadow-glow hover:bg-primary/90"
            onClick={() => navigate({ to: "/kiosk" })}
          >
            <ScanLine className="h-4 w-4" />
            Launch Kiosk
          </Button>

          {session.isStaff && (
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Mark Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>Mark Manual Attendance</DialogTitle>
                  <DialogDescription>
                    Record attendance manually for an employee or student.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Personnel *</Label>
                    <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select person..." />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.person_code}) — {p.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={manualStatus} onValueChange={setManualStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="half_day">Half-day</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Check-in Time</Label>
                      <Input
                        type="time"
                        value={manualCheckIn}
                        onChange={(e) => setManualCheckIn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Check-out Time</Label>
                      <Input
                        type="time"
                        value={manualCheckOut}
                        onChange={(e) => setManualCheckOut(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Reason / Note</Label>
                    <Input
                      placeholder="e.g. Approved leave, forgotten scan, outdoor duty"
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setManualOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => markManualMutation.mutate()}
                    disabled={markManualMutation.isPending || !selectedPersonId}
                  >
                    {markManualMutation.isPending ? "Saving..." : "Save Record"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Present Card */}
        <Card className="card-soft border-border/80 transition-all hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Present Today
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {todayLoading || peopleLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight">{presentCount}</span>
                  <span className="text-xs font-semibold text-success">
                    {attendanceRate}% of roster
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalAttended} total check-ins recorded
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Late Card */}
        <Card className="card-soft border-border/80 transition-all hover:border-warning/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Late Arrivals</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight">{lateCount}</span>
                  <span className="text-xs text-muted-foreground">
                    {punctualityRate}% on-time rate
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Arrived after shift grace period</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Absent Card */}
        <Card className="card-soft border-border/80 transition-all hover:border-destructive/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unaccounted / Absent</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <UserX className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {todayLoading || peopleLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight">{absentCount}</span>
                  <span className="text-xs text-destructive">
                    {totalPeople > 0 ? Math.round((absentCount / totalPeople) * 100) : 0}% absent
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">No check-in received yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active People Card */}
        <Card className="card-soft border-border/80 transition-all hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Roster</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {peopleLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold tracking-tight">{totalPeople}</span>
                  <Link
                    to="/people"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Manage <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">Enrolled personnel & staff</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Charts & Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Visual Analytics (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Trend Chart */}
          <Card className="card-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">7-Day Attendance Trend</CardTitle>
                <CardDescription>Daily present vs late attendance volume</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 border-primary/20 text-xs">
                <Sparkles className="h-3 w-3 text-primary" /> Live
              </Badge>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : trendData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No attendance history available for chart.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "12px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      <Bar dataKey="present" name="Present" fill="oklch(0.63 0.17 155)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="late" name="Late" fill="oklch(0.75 0.16 75)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Breakdown */}
          <Card className="card-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Department Attendance</CardTitle>
              <CardDescription>Attendance coverage across organizational units today</CardDescription>
            </CardHeader>
            <CardContent>
              {peopleLoading || todayLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : departmentStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No departments configured yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {departmentStats.map((dept) => (
                    <div key={dept.department} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{dept.department}</span>
                        <span className="text-muted-foreground">
                          {dept.attended} / {dept.total} ({dept.rate}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min(100, dept.rate)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Feed (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="card-soft flex h-full flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Today's Check-in Feed</CardTitle>
                  <CardDescription>
                    {todayAttendance.length} check-in{todayAttendance.length === 1 ? "" : "s"} logged today
                  </CardDescription>
                </div>
                <Link
                  to="/attendance"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all
                </Link>
              </div>

              {/* Feed Search */}
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, code, dept..."
                  value={feedSearch}
                  onChange={(e) => setFeedSearch(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto px-4 pb-4">
              {todayLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
                  <ScanLine className="h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium">No check-ins found</p>
                  <p className="text-xs text-muted-foreground">
                    {feedSearch ? "Try a different search query" : "Start scanning faces in kiosk mode"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate({ to: "/kiosk" })}
                  >
                    Open Kiosk
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredFeed.map((row) => {
                    const person = row.people;
                    const initials = (person?.name || "?")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-accent/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {person?.photo_url ? (
                            <img
                              src={person.photo_url}
                              alt={person.name}
                              className="h-9 w-9 shrink-0 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {person?.name || "Unknown"}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {person?.person_code} • {person?.department || "General"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                                STATUS_COLORS[row.status] || ""
                              }`}
                            >
                              {STATUS_LABELS[row.status] || row.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                            In: {formatTime(row.check_in)}
                            {row.check_out && ` • Out: ${formatTime(row.check_out)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
