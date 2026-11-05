import { useState, useMemo, useEffect } from "react";
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
  CalendarRange,
  Palmtree,
  CalendarDays,
  Megaphone,
  FileText,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  UserCheck,
  Building2,
  Loader2,
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
  formatHours,
  totalHours,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flowpeople by Fluxora" },
      { name: "description", content: "Corporate attendance overview, leaves, and analytics." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const session = useSession();

  if (session.loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (session.isAdmin) {
    return <AdminDashboardView />;
  }
  if (session.isManager) {
    return <ManagerDashboardView />;
  }
  return <EmployeeDashboardView />;
}

/* =========================================================================================
   1. ADMIN DASHBOARD VIEW
========================================================================================= */
function AdminDashboardView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [feedSearch, setFeedSearch] = useState("");
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected">("approved");
  const [managerComment, setManagerComment] = useState("");

  // Query Active Employees
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["admin-employees-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, department_id, departments(name)")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query Today's Attendance
  const { data: todayRecords = [], isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ["admin-today-attendance", todayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, date, check_in, check_out, status, method, employee_id, employees(full_name, employee_code, departments(name))")
        .eq("date", todayKey)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Realtime updates for Admin Dashboard
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
          queryClient.invalidateQueries({ queryKey: ["admin-trend-14d"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-pending-leaves"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query Pending Leaves
  const { data: pendingLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ["admin-pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, from_date, to_date, days, reason, status, applied_at, employee_id, leave_type_id, employees(full_name, employee_code, departments(name)), leave_types(name, color)")
        .eq("status", "pending")
        .order("applied_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Query 14-day Trend Data
  const { data: trendData = [], isLoading: trendLoading } = useQuery({
    queryKey: ["admin-trend-14d"],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 13);
      const startKey = toDateKey(d);

      const { data, error } = await supabase
        .from("attendance")
        .select("date, status")
        .gte("date", startKey)
        .lte("date", todayKey);
      if (error) throw error;

      const map: Record<string, { date: string; present: number; late: number; on_leave: number; absent: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const k = toDateKey(day);
        const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        map[k] = { date: label, present: 0, late: 0, on_leave: 0, absent: 0 };
      }

      (data ?? []).forEach((row) => {
        if (map[row.date]) {
          if (row.status === "present") map[row.date].present++;
          else if (row.status === "late") map[row.date].late++;
          else if (row.status === "on_leave") map[row.date].on_leave++;
          else if (row.status === "absent") map[row.date].absent++;
        }
      });

      return Object.values(map);
    },
  });

  // Decision Mutation for quick leave approvals
  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReq) return;
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: decisionAction,
          manager_comment: managerComment.trim() || null,
        })
        .eq("id", selectedReq.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Leave request ${decisionAction}`);
      setDecisionModalOpen(false);
      setSelectedReq(null);
      setManagerComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to process decision");
    },
  });

  // Calculate stats
  const totalEmployees = employees.length;
  const presentCount = todayRecords.filter((r) => r.status === "present" || r.status === "late").length;
  const onLeaveCount = todayRecords.filter((r) => r.status === "on_leave").length;
  const pendingCount = pendingLeaves.length;
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  const filteredFeed = todayRecords.filter((r) => {
    if (!feedSearch) return true;
    const name = r.employees?.full_name?.toLowerCase() || "";
    const code = r.employees?.employee_code?.toLowerCase() || "";
    const q = feedSearch.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time biometric attendance metrics, leave queue, and corporate trends.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchToday()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/kiosk" })} className="gap-1.5 bg-primary">
            <ScanLine className="h-4 w-4" />
            Launch Kiosk
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empLoading ? "..." : totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">Active registered personnel</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today's Attendance</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {todayLoading ? "..." : `${attendanceRate}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{presentCount} of {totalEmployees} checked in</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">On Leave Today</CardTitle>
            <Palmtree className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {todayLoading ? "..." : onLeaveCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Approved absences</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <CalendarRange className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {leavesLoading ? "..." : pendingCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting decision</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Bar */}
      <Card className="bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm font-semibold">Quick Actions</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/people" })} className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Add Employee
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/leaves" })} className="gap-1.5 text-xs">
              <CalendarRange className="h-3.5 w-3.5" />
              Review Leaves
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/reports" })} className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Export Report
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/settings" })} className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Drive Backup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Chart & Pending Leaves Queue */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">14-Day Attendance Trend</CardTitle>
            <CardDescription>Daily presence, punctuality, and leaves across the workforce.</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="on_leave" name="On Leave" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Leaves Queue (1 col) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Leave Approvals</CardTitle>
              <CardDescription>Quick decisions</CardDescription>
            </div>
            <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {leavesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : pendingLeaves.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/50 mb-1" />
                No pending leave requests. Inbox is clear!
              </div>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map((req) => (
                  <div key={req.id} className="rounded-xl border p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{req.employees?.full_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {req.days}d {req.leave_types?.name}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate">{req.reason || "Personal work"}</p>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-[10px] text-muted-foreground">{req.from_date}</span>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-emerald-600 hover:bg-emerald-500/10 text-[10px]"
                          onClick={() => {
                            setSelectedReq(req);
                            setDecisionAction("approved");
                            setDecisionModalOpen(true);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-rose-600 hover:bg-rose-500/10 text-[10px]"
                          onClick={() => {
                            setSelectedReq(req);
                            setDecisionAction("rejected");
                            setDecisionModalOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Check-Ins Live Feed */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Today's Biometric Feed</CardTitle>
            <CardDescription>Live attendance records logged at kiosks or authorized portals.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search feed..."
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No check-in entries logged yet today.
            </div>
          ) : (
            <div className="divide-y">
              {filteredFeed.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {rec.employees?.full_name?.slice(0, 2).toUpperCase() || "EM"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{rec.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rec.employees?.employee_code} • {rec.employees?.departments?.name || "General"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right space-y-0.5">
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <span className="text-muted-foreground">In: <strong className="text-foreground font-mono">{rec.check_in ? formatTime(rec.check_in) : "--:--"}</strong></span>
                        <span className="text-muted-foreground">Out: <strong className="text-foreground font-mono">{rec.check_out ? formatTime(rec.check_out) : "On Site"}</strong></span>
                      </div>
                      {rec.check_in && rec.check_out ? (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Duration: {formatHours(totalHours(rec.check_in, rec.check_out))}
                        </p>
                      ) : (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Active attendance (Currently on site)
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rec.check_out
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {rec.check_out ? "Checked Out" : "Checked In"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Decision Modal */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{decisionAction} Leave Request</DialogTitle>
            <DialogDescription>
              Confirm your decision for {selectedReq?.employees?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-lg border p-3 bg-muted/40 space-y-1">
              <div className="flex justify-between font-medium">
                <span>Duration:</span>
                <span>{selectedReq?.total_days} day(s)</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Period:</span>
                <span>{selectedReq?.start_date} to {selectedReq?.end_date}</span>
              </div>
              <div className="text-xs pt-1">
                <span className="font-medium">Reason: </span>
                <span className="text-muted-foreground">{selectedReq?.reason || "None"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-comment" className="text-xs">Manager / Admin Comment</Label>
              <Input
                id="admin-comment"
                placeholder="Optional notes or feedback..."
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionAction === "approved" ? "default" : "destructive"}
              onClick={() => decisionMutation.mutate()}
              disabled={decisionMutation.isPending}
            >
              {decisionMutation.isPending ? "Processing..." : `Confirm ${decisionAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================================
   2. MANAGER DASHBOARD VIEW
========================================================================================= */
function ManagerDashboardView() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected">("approved");
  const [managerComment, setManagerComment] = useState("");

  // Query Team Members
  const { data: team = [], isLoading: teamLoading } = useQuery({
    queryKey: ["manager-team-members", session.employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, department_id, departments(name)")
        .or(`manager_id.eq.${session.employeeId},department_id.eq.${session.departmentId}`)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!session.employeeId,
  });

  // Query Today's Team Attendance
  const { data: teamToday = [], isLoading: todayLoading } = useQuery({
    queryKey: ["manager-team-today", todayKey, session.employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, date, check_in, check_out, status, method, employee_id, employees(full_name, employee_code)")
        .eq("date", todayKey);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Realtime updates for Manager Dashboard
  useEffect(() => {
    const channel = supabase
      .channel("manager-dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["manager-team-today"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["manager-team-pending-leaves"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query Pending Team Leaves
  const { data: teamPendingLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ["manager-team-pending-leaves", session.employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, from_date, to_date, days, reason, status, applied_at, employee_id, leave_type_id, employees(full_name, employee_code), leave_types(name, color)")
        .eq("status", "pending")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Query Upcoming Holidays
  const { data: upcomingHolidays = [] } = useQuery({
    queryKey: ["manager-upcoming-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("id, date, name, is_optional")
        .gte("date", todayKey)
        .order("date")
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReq) return;
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: decisionAction,
          manager_comment: managerComment.trim() || null,
        })
        .eq("id", selectedReq.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Leave request ${decisionAction}`);
      setDecisionModalOpen(false);
      setSelectedReq(null);
      setManagerComment("");
      queryClient.invalidateQueries({ queryKey: ["manager-team-pending-leaves"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to process decision");
    },
  });

  const teamIds = new Set(team.map((t) => t.id));
  const teamRecords = teamToday.filter((r) => teamIds.has(r.employee_id));
  const presentCount = teamRecords.filter((r) => r.status === "present" || r.status === "late").length;
  const onLeaveCount = teamRecords.filter((r) => r.status === "on_leave").length;
  const absentCount = Math.max(0, team.length - presentCount - onLeaveCount);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Team Overview</h1>
            <Badge variant="outline" className="border-amber-200 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {session.departmentName || "Engineering"} Dept
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your direct team presence, approve leaves, and track department schedules.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: "/people" })} className="gap-1.5 self-start sm:self-auto">
          <UserPlus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {/* Team Presence Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Team</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLoading ? "..." : team.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Direct reports & department</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Present Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {todayLoading ? "..." : presentCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Checked in at kiosk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">On Leave</CardTitle>
            <Palmtree className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {todayLoading ? "..." : onLeaveCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Approved time off</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Absent</CardTitle>
            <UserX className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {todayLoading ? "..." : absentCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Not checked in yet</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Team Leaves & Upcoming Events */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Approvals (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Team Leave Inbox</CardTitle>
              <CardDescription>Requests awaiting your manager approval</CardDescription>
            </div>
            <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
              Open Leaves
            </Link>
          </CardHeader>
          <CardContent>
            {leavesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : teamPendingLeaves.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/50 mb-2" />
                No pending leave requests from your team!
              </div>
            ) : (
              <div className="divide-y">
                {teamPendingLeaves.map((req) => (
                  <div key={req.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{req.employees?.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {req.days}d {req.leave_types?.name}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.from_date} to {req.to_date} • {req.reason || "No reason specified"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => {
                          setSelectedReq(req);
                          setDecisionAction("approved");
                          setDecisionModalOpen(true);
                        }}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs text-rose-600 hover:bg-rose-500/10"
                        onClick={() => {
                          setSelectedReq(req);
                          setDecisionAction("rejected");
                          setDecisionModalOpen(true);
                        }}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Holidays & Events (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Holidays</CardTitle>
            <CardDescription>Company non-working days</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No upcoming holidays scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      <span>{new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="text-sm leading-none">{h.date.split("-")[2]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground">{h.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Check-In & Check-Out Today */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Attendance Log (Today)</CardTitle>
          <CardDescription>Real-time check-in and check-out entries for your department.</CardDescription>
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : teamRecords.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No team attendance records logged yet today.
            </p>
          ) : (
            <div className="divide-y">
              {teamRecords.map((rec: any) => (
                <div key={rec.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {rec.employees?.full_name?.slice(0, 2).toUpperCase() || "TM"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{rec.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{rec.employees?.employee_code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right space-y-0.5">
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <span className="text-muted-foreground">In: <strong className="text-foreground font-mono">{rec.check_in ? formatTime(rec.check_in) : "--:--"}</strong></span>
                        <span className="text-muted-foreground">Out: <strong className="text-foreground font-mono">{rec.check_out ? formatTime(rec.check_out) : "On Site"}</strong></span>
                      </div>
                      {rec.check_in && rec.check_out ? (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Duration: {formatHours(totalHours(rec.check_in, rec.check_out))}
                        </p>
                      ) : (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Currently on site
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rec.check_out
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {rec.check_out ? "Checked Out" : "Checked In"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Modal */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{decisionAction} Leave Request</DialogTitle>
            <DialogDescription>
              Provide optional feedback for {selectedReq?.employees?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="mgr-comment" className="text-xs">Manager Comment</Label>
              <Input
                id="mgr-comment"
                placeholder="e.g. Approved. Please ensure task handover."
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionAction === "approved" ? "default" : "destructive"}
              onClick={() => decisionMutation.mutate()}
              disabled={decisionMutation.isPending}
            >
              {decisionMutation.isPending ? "Confirming..." : `Confirm ${decisionAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================================
   3. EMPLOYEE DASHBOARD VIEW
========================================================================================= */
function EmployeeDashboardView() {
  const session = useSession();
  const navigate = useNavigate();
  const todayKey = toDateKey(new Date());

  // Query Today's Attendance for Employee
  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ["employee-today-status", todayKey, session.employeeId],
    queryFn: async () => {
      if (!session.employeeId) return null;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", session.employeeId)
        .eq("date", todayKey)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!session.employeeId,
  });

  // Query Leave Balances
  const { data: balances = [], isLoading: balLoading } = useQuery({
    queryKey: ["employee-balances", session.employeeId],
    queryFn: async () => {
      if (!session.employeeId) return [];
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("leave_balances")
        .select("leave_type_id, total, used, remaining, leave_types(name, color)")
        .eq("employee_id", session.employeeId)
        .eq("year", currentYear);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!session.employeeId,
  });

  // Query Recent Attendance (last 7 days)
  const { data: recentRecords = [], isLoading: recentLoading } = useQuery({
    queryKey: ["employee-recent-records", session.employeeId],
    queryFn: async () => {
      if (!session.employeeId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", session.employeeId)
        .order("date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session.employeeId,
  });

  // Query Pending Requests
  const { data: myPending = [] } = useQuery({
    queryKey: ["employee-pending-requests", session.employeeId],
    queryFn: async () => {
      if (!session.employeeId) return [];
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, from_date, to_date, days, reason, status, leave_types(name)")
        .eq("employee_id", session.employeeId)
        .eq("status", "pending")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session.employeeId,
  });

  // Query Announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ["employee-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query Upcoming Holidays
  const { data: holidays = [] } = useQuery({
    queryKey: ["employee-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", todayKey)
        .order("date")
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.fullName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.designation || "Staff Member"} • {session.departmentName || "Engineering"}
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/leaves" })} className="gap-2 self-start sm:self-auto">
          <Palmtree className="h-4 w-4" />
          Apply for Leave
        </Button>
      </div>

      {/* Today's Status Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isCheckedIn ? "bg-emerald-500 text-white shadow-md" : "bg-muted text-muted-foreground"
              }`}>
              {isCheckedIn ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isCheckedIn ? "default" : "outline"}
                  className={isCheckedOut ? "bg-emerald-600 text-white" : isCheckedIn ? "bg-blue-600 text-white" : ""}
                >
                  {isCheckedOut ? "Work Day Completed" : isCheckedIn ? "Checked In (Active)" : "Not Checked In Yet"}
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
                  <span>
                    Check-in: <strong className="text-foreground font-mono">{isCheckedIn ? formatTime(todayRecord.check_in!) : "--:--"}</strong>
                  </span>
                  <span>
                    Check-out: <strong className="text-foreground font-mono">{isCheckedOut ? formatTime(todayRecord.check_out!) : isCheckedIn ? "On Site (Pending Check-out)" : "--:--"}</strong>
                  </span>
                </div>
                {isCheckedIn && isCheckedOut && (
                  <p className="text-xs text-muted-foreground">
                    Total Time Logged: <strong className="text-foreground font-mono">{formatHours(totalHours(todayRecord.check_in!, todayRecord.check_out!))}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/reports" })}>
            View My Report
          </Button>
        </CardContent>
      </Card>

      {/* Leave Balances Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">My Leave Balances</h3>
          <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
            Manage Leaves
          </Link>
        </div>

        {balLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((b) => {
              const remaining = Number(b.remaining ?? (b.total - b.used));
              const used = Number(b.used ?? 0);
              const total = Number(b.total ?? 0);
              return (
                <Card key={b.leave_type_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{b.leave_types?.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {used} / {total} used
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{remaining} <span className="text-xs font-normal text-muted-foreground">days left</span></div>
                  <Progress value={used} max={total} className="h-1.5" />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Announcements & Recent Attendance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Attendance (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Attendance</CardTitle>
            <CardDescription>Your check-in and check-out activity over past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : recentRecords.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No recent attendance records found.</p>
            ) : (
              <div className="divide-y text-xs">
                {recentRecords.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-semibold">{formatDate(r.date)}</span>
                      <span className="text-muted-foreground ml-2">
                        {r.check_in ? formatTime(r.check_in) : "--:--"} to {r.check_out ? formatTime(r.check_out) : "--:--"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize text-[10px] ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] || ""}`}
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Announcements (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Announcements</CardTitle>
            <CardDescription>Latest company notices</CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No announcements posted.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a: any) => (
                  <div key={a.id} className="rounded-xl border p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Megaphone className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate">{a.title}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-[11px]">{a.message || a.content}</p>
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
