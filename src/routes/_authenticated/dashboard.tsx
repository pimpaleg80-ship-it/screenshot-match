import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  UserPlus,
  ClipboardCheck,
  ArrowUpRight,
  RefreshCw,
  Search,
  Calendar as CalendarIcon,
  HardDrive,
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
  MapPin,
  Shield,
} from "lucide-react";
import { GeofenceAttendanceCard } from "@/components/geofence-attendance-card";
import { EmployeeRegistrationDialog } from "@/components/employees/EmployeeRegistrationDialog";
import { excludeSuperadminRecords, type OrgAssignableRole } from "@/lib/access-control";
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
import { PageContainer, PageHeader, MetricStrip } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
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
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [feedSearch, setFeedSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected">("approved");
  const [managerComment, setManagerComment] = useState("");

  // Query Active Employees (Root Superadmin is always excluded)
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["admin-employees-count", session.organizationId],
    enabled: !session.loading && !!session.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email, employee_code, designation, department_id, is_superadmin, departments(name)")
        .eq("organization_id", session.organizationId)
        .eq("status", "active")
        .neq("is_superadmin", true)
        .order("full_name");
      if (error) throw error;
      return excludeSuperadminRecords(data ?? []);
    },
  });

  // Query shifts for employee/manager registration dialog
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("shifts").select("id, name");
      if (error) return [];
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Query user_roles for org members so HR can assign Employee or Manager on HR Dashboard
  const { data: userRolesRows = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["hr-dashboard-user-roles", session.organizationId],
    enabled: !session.loading && session.isAdmin && !!session.organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of userRolesRows) {
      map.set(row.user_id, row.role);
    }
    return map;
  }, [userRolesRows]);

  const manageableMembers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return (employees as any[])
      .filter((e) => {
        if (!e.user_id) return false;
        const currentRole = roleByUserId.get(e.user_id) || "employee";
        if (currentRole === "admin" || currentRole === "superadmin" || currentRole === "super_admin") {
          return false;
        }
        if (!q) return true;
        return (
          e.full_name?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.employee_code?.toLowerCase().includes(q) ||
          e.departments?.name?.toLowerCase().includes(q)
        );
      })
      .map((e) => ({
        ...e,
        assignedRole: (roleByUserId.get(e.user_id) === "manager" ? "manager" : "employee") as OrgAssignableRole,
      }));
  }, [employees, roleByUserId, roleSearch]);

  const departmentsList = useMemo(() => {
    const names = new Set<string>(["General"]);
    for (const e of employees as any[]) {
      if (e.departments?.name) names.add(e.departments.name);
    }
    return Array.from(names).sort();
  }, [employees]);

  const existingEmployeesList = useMemo(
    () => (employees as any[]).map((e) => ({ id: e.id, name: `${e.full_name} (${e.employee_code})` })),
    [employees],
  );

  // HR switches an existing org account cleanly between Employee and Manager
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: OrgAssignableRole }) => {
      setUpdatingRoleUserId(userId);
      const { error } = await supabase.rpc("manage_org_user_role", {
        p_target_user_id: userId,
        p_new_role: newRole,
      });
      if (error) throw error;
      return newRole;
    },
    onSuccess: (newRole) => {
      toast.success(`Role updated to ${newRole === "manager" ? "Manager" : "Employee"}`);
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-profiles-and-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-employees-count"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update role");
    },
    onSettled: () => {
      setUpdatingRoleUserId(null);
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes("admin-dashboard-realtime")) {
          supabase.removeChannel(ch);
        }
      });
      const channelName = `admin-dashboard-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      channel = supabase.channel(channelName);
      const orgFilter = session.organizationId
        ? `organization_id=eq.${session.organizationId}`
        : undefined;
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
            ...(orgFilter ? { filter: orgFilter } : {}),
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
            ...(orgFilter ? { filter: orgFilter } : {}),
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["admin-pending-leaves"] });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime admin dashboard subscription error:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing admin dashboard channel:", e);
        }
      }
    };
  }, [queryClient, session.organizationId]);

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
        const entry = map[row.date];
        if (entry) {
          if (row.status === "present") entry.present++;
          else if (row.status === "late") entry.late++;
          else if (row.status === "on_leave") entry.on_leave++;
          else if (row.status === "absent") entry.absent++;
        }
      });

      return Object.values(map);
    },
  });

  // Decision Mutation for quick leave approvals
  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReq) return;
      const comment = managerComment.trim();
      if (decisionAction === "rejected" && !comment) {
        throw new Error("A reason for rejection is required");
      }
      const { error } =
        decisionAction === "approved"
          ? await supabase.rpc("approve_leave_transactional", {
              p_request_id: selectedReq.id,
              p_comment: comment || null,
            })
          : await supabase.rpc("reject_leave_transactional", {
              p_request_id: selectedReq.id,
              p_comment: comment,
            });
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
    <PageContainer>
      {/* Top Header */}
      <PageHeader
        breadcrumbs={[{ label: "HR Dashboard" }]}
        title="HR Dashboard"
        description="Provision employees & managers, assign team roles, and monitor real-time attendance."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetchToday()} className="gap-1.5 text-xs h-9">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setRegisterModalOpen(true)} className="gap-1.5 bg-primary text-xs h-9">
              <UserPlus className="h-3.5 w-3.5" />
              Add Employee / Manager
            </Button>
          </>
        }
      />

      {/* Flat Metric Strip */}
      <MetricStrip
        metrics={[
          {
            label: "Total Workforce",
            value: empLoading ? "..." : totalEmployees,
            subtext: "Active registered personnel",
            icon: Users,
            variant: "default",
          },
          {
            label: "Today's Attendance",
            value: todayLoading ? "..." : `${attendanceRate}%`,
            subtext: `${presentCount} of ${totalEmployees} checked in`,
            icon: CheckCircle2,
            variant: "success",
          },
          {
            label: "On Leave Today",
            value: todayLoading ? "..." : onLeaveCount,
            subtext: "Approved absences",
            icon: Palmtree,
            variant: "warning",
          },
          {
            label: "Pending Approvals",
            value: leavesLoading ? "..." : pendingCount,
            subtext: "Awaiting decision",
            icon: CalendarRange,
            variant: "danger",
          },
        ]}
      />

      {/* Quick Action Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-card/70 border border-border/30 rounded-xl shadow-xs">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</span>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRegisterModalOpen(true)} className="gap-1.5 text-xs h-8">
            <UserPlus className="h-3.5 w-3.5" />
            Add Employee / Manager
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/leaves" })} className="gap-1.5 text-xs h-8">
            <CalendarRange className="h-3.5 w-3.5" />
            Review Leaves
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/reports" })} className="gap-1.5 text-xs h-8">
            <BarChart3 className="h-3.5 w-3.5" />
            Export Report
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/settings" })} className="gap-1.5 text-xs h-8">
            <MapPin className="h-3.5 w-3.5" />
            Office Geofence
          </Button>
        </div>
      </div>

      {/* Attendance Chart & Pending Leaves Queue */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">14-Day Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "hsl(var(--card-foreground))",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
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
            </div>
            <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {leavesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
                  <div key={req.id} className="rounded-lg border p-3 text-xs space-y-1.5">
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

      {/* Team Access & Role Management (Employee / Manager) */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Team Access &amp; Role Management
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select Employee or Manager access for team members, or provision new authenticated accounts.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by name, code, email..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={() => setRegisterModalOpen(true)} className="gap-1.5 text-xs h-8 shrink-0">
              <UserPlus className="h-3.5 w-3.5" />
              Provision Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {empLoading || rolesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : manageableMembers.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No Employee or Manager accounts found yet. Click{" "}
              <button
                type="button"
                onClick={() => setRegisterModalOpen(true)}
                className="text-primary font-semibold hover:underline"
              >
                Provision Account
              </button>{" "}
              to create an authenticated Employee or Manager.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {manageableMembers.map((member: any) => (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{member.full_name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0 ${
                          member.assignedRole === "manager"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {member.assignedRole}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {member.email} • {member.employee_code} • {member.departments?.name || "General"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={member.assignedRole}
                      disabled={updatingRoleUserId === member.user_id}
                      onValueChange={(value) => {
                        const nextRole = value as OrgAssignableRole;
                        if (nextRole !== member.assignedRole) {
                          updateMemberRoleMutation.mutate({
                            userId: member.user_id,
                            newRole: nextRole,
                          });
                        }
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Select role for ${member.full_name}`}
                        className="w-40 h-8 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Check-Ins Live Feed */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Today's Biometric Feed</CardTitle>
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
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No check-in entries logged yet today.
            </div>
          ) : (
            <div className="divide-y">
              {filteredFeed.map((rec) => (
                <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {rec.employees?.full_name?.slice(0, 2).toUpperCase() || "EM"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{rec.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rec.employees?.employee_code} • {rec.employees?.departments?.name || "General"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs w-full sm:w-auto pl-12 sm:pl-0">
                    <div className="text-left sm:text-right space-y-0.5">
                      <div className="flex items-center gap-2 sm:gap-3 text-xs">
                        <span className="text-muted-foreground text-[11px] sm:text-xs">In: <strong className="text-foreground font-mono">{rec.check_in ? formatTime(rec.check_in) : "--:--"}</strong></span>
                        <span className="text-muted-foreground text-[11px] sm:text-xs">Out: <strong className="text-foreground font-mono">{rec.check_out ? formatTime(rec.check_out) : "On Site"}</strong></span>
                      </div>
                      {rec.check_in && rec.check_out ? (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Duration: {formatHours(totalHours(rec.check_in, rec.check_out))}
                        </p>
                      ) : (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Active attendance (On site)
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
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
                <span>{selectedReq?.days ?? 0} day(s)</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Period:</span>
                <span>{selectedReq?.from_date} to {selectedReq?.to_date}</span>
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

      {/* Direct HR Employee / Manager Registration Dialog */}
      <EmployeeRegistrationDialog
        open={registerModalOpen}
        onOpenChange={setRegisterModalOpen}
        departments={departmentsList}
        existingEmployees={existingEmployeesList}
        shifts={shifts}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-employees-count"] });
          queryClient.invalidateQueries({ queryKey: ["hr-dashboard-user-roles"] });
          queryClient.invalidateQueries({ queryKey: ["user-profiles-and-roles"] });
          queryClient.invalidateQueries({ queryKey: ["people-list"] });
        }}
      />
    </PageContainer>
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
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
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
        .neq("is_superadmin", true)
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes("manager-dashboard-realtime")) {
          supabase.removeChannel(ch);
        }
      });
      const channelName = `manager-dashboard-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      channel = supabase.channel(channelName);
      const orgFilter = session.organizationId
        ? `organization_id=eq.${session.organizationId}`
        : undefined;
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
            ...(orgFilter ? { filter: orgFilter } : {}),
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
            ...(orgFilter ? { filter: orgFilter } : {}),
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["manager-team-pending-leaves"] });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime manager dashboard subscription error:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing manager dashboard channel:", e);
        }
      }
    };
  }, [queryClient, session.organizationId]);

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
      const comment = managerComment.trim();
      if (decisionAction === "rejected" && !comment) {
        throw new Error("A reason for rejection is required");
      }
      const { error } =
        decisionAction === "approved"
          ? await supabase.rpc("approve_leave_transactional", {
              p_request_id: selectedReq.id,
              p_comment: comment || null,
            })
          : await supabase.rpc("reject_leave_transactional", {
              p_request_id: selectedReq.id,
              p_comment: comment,
            });
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
    <PageContainer>
      {/* Header */}
      <PageHeader
        breadcrumbs={[{ label: "Team Overview" }]}
        title="Team Overview"
        badge={
          <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground text-xs">
            {session.departmentName || "Engineering"} Dept
          </Badge>
        }
        description="Manage your direct team presence, approve leaves, and track department schedules."
        actions={
          <Button size="sm" onClick={() => setRegisterModalOpen(true)} className="gap-1.5 text-xs h-9">
            <UserPlus className="h-3.5 w-3.5" />
            Add Team Employee
          </Button>
        }
      />

      {/* Flat Team Presence Metric Strip */}
      <MetricStrip
        metrics={[
          {
            label: "Total Team",
            value: teamLoading ? "..." : team.length,
            subtext: "Direct reports & department",
            icon: Users,
            variant: "default",
          },
          {
            label: "Present Today",
            value: todayLoading ? "..." : presentCount,
            subtext: "Checked in on site",
            icon: CheckCircle2,
            variant: "success",
          },
          {
            label: "On Leave",
            value: todayLoading ? "..." : onLeaveCount,
            subtext: "Approved time off",
            icon: Palmtree,
            variant: "warning",
          },
          {
            label: "Absent Today",
            value: todayLoading ? "..." : absentCount,
            subtext: "Not checked in yet",
            icon: UserX,
            variant: "danger",
          },
        ]}
      />

      {/* Pending Team Leaves & Upcoming Events */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Approvals (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Team Leave Inbox</CardTitle>
            </div>
            <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
              Open Leaves
            </Link>
          </CardHeader>
          <CardContent>
            {leavesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
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
          </CardHeader>
          <CardContent>
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No upcoming holidays scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg border p-2.5">
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
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : teamRecords.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No team attendance records logged yet today.
            </p>
          ) : (
            <div className="divide-y">
              {teamRecords.map((rec: any) => (
                <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {rec.employees?.full_name?.slice(0, 2).toUpperCase() || "TM"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{rec.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{rec.employees?.employee_code}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs w-full sm:w-auto pl-12 sm:pl-0">
                    <div className="text-left sm:text-right space-y-0.5">
                      <div className="flex items-center gap-2 sm:gap-3 text-xs">
                        <span className="text-muted-foreground text-[11px] sm:text-xs">In: <strong className="text-foreground font-mono">{rec.check_in ? formatTime(rec.check_in) : "--:--"}</strong></span>
                        <span className="text-muted-foreground text-[11px] sm:text-xs">Out: <strong className="text-foreground font-mono">{rec.check_out ? formatTime(rec.check_out) : "On Site"}</strong></span>
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
                      className={`text-[10px] shrink-0 ${
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
                placeholder="Optional review comment"
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

      {/* Manager Employee Provisioning Dialog (locked strictly to Employee role) */}
      <EmployeeRegistrationDialog
        open={registerModalOpen}
        onOpenChange={setRegisterModalOpen}
        departments={session.departmentName ? [session.departmentName] : ["General"]}
        existingEmployees={
          session.employeeId
            ? [{ id: session.employeeId, name: session.fullName || "Me" }]
            : []
        }
        shifts={[]}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["manager-team-members"] });
          queryClient.invalidateQueries({ queryKey: ["people-list"] });
        }}
      />
    </PageContainer>
  );
}

/* =========================================================================================
   3. EMPLOYEE DASHBOARD VIEW
========================================================================================= */
function EmployeeDashboardView() {
  const session = useSession();
  const navigate = useNavigate();
  const todayKey = toDateKey(new Date());

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

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        breadcrumbs={[{ label: "My Workplace" }]}
        title={`Welcome back, ${session.fullName.split(" ")[0]}!`}
        description={`${session.designation || "Staff Member"} • ${session.departmentName || "Engineering"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/reports" })} className="text-xs h-9">
              View My Report
            </Button>
            <Button onClick={() => navigate({ to: "/leaves" })} className="gap-2 text-xs h-9">
              <Palmtree className="h-4 w-4" />
              Apply for Leave
            </Button>
          </div>
        }
      />

      {/* Live Auto-Synced GPS Geofence Attendance (Check-In/Out button appears ONLY inside selected HR office zone) */}
      {session.employeeId && <GeofenceAttendanceCard employeeId={session.employeeId} />}

      {/* Leave Balances Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold">My Leave Balances</h3>
          <Link to="/leaves" className="text-xs font-semibold text-primary hover:underline">
            Manage Leaves
          </Link>
        </div>

        {balLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {balances.map((b) => {
              const remaining = Number(b.remaining ?? (b.total - b.used));
              const used = Number(b.used ?? 0);
              const total = Number(b.total ?? 0);
              return (
                <Card key={b.leave_type_id} className="p-3.5 sm:p-4 space-y-2">
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
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
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
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No announcements posted.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a: any) => (
                  <div key={a.id} className="rounded-lg border p-3 text-xs space-y-1">
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
    </PageContainer>
  );
}