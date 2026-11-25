import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  FileText,
  UserCheck,
  Building,
  Upload,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  Download,
  Shield,
  Sparkles,
  Search,
  ExternalLink,
  Users,
  Settings,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  calculateWorkingLeaveDays,
  checkLeaveOverlap,
  getLeaveRequestDisplayStatus,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type LeaveBalance,
  type LeaveType,
  type Holiday,
  type LeavePolicy,
} from "@/lib/leave";
import { toDateKey, formatDate } from "@/lib/attendance";
import { PageContainer, PageHeader, TableContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ApplyLeaveDialog } from "@/components/leaves/ApplyLeaveDialog";
import { LeaveApprovalsManager } from "@/components/leaves/LeaveApprovalsManager";
import { TeamLeaveCalendarView } from "@/components/leaves/TeamLeaveCalendarView";
import { LeavePolicyConfigManager } from "@/components/leaves/LeavePolicyConfigManager";

export const Route = createFileRoute("/_authenticated/leaves")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leave Management — Flowpeople by Fluxora" },
      { name: "description", content: "Apply for leaves, multi-tier approvals, policy configuration, and team calendar." },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [activeTab, setActiveTab] = useState<string>("my-leaves");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [adminAddModalOpen, setAdminAddModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Filter state for my leaves tab
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Direct grant state for Admin
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("");
  const [grantLeaveTypeId, setGrantLeaveTypeId] = useState<string>("");
  const [grantFromDate, setGrantFromDate] = useState<string>(toDateKey(new Date()));
  const [grantToDate, setGrantToDate] = useState<string>(toDateKey(new Date()));
  const [grantReason, setGrantReason] = useState<string>("");

  // 1. Fetch Organization Leave Policy
  const { data: leavePolicy } = useQuery({
    queryKey: ["leave-policy-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_policies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data as unknown as LeavePolicy) ?? null;
    },
  });

  // 2. Fetch app settings fallback
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings-leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) return null;
      return data ?? null;
    },
  });

  const weeklyOffDays = (leavePolicy?.weekly_off_days as number[]) || (appSettings?.weekly_off_days as number[]) || [0, 6];
  const sandwichRuleEnabled = leavePolicy?.sandwich_rule_enabled ?? false;

  // 3. Fetch Holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays-list", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("date, title, name, is_optional")
        .gte("date", `${currentYear}-01-01`)
        .lte("date", `${currentYear}-12-31`)
        .order("date");
      if (error) return [];
      return (data ?? []).map((h) => ({
        date: h.date,
        title: h.title || h.name || "Holiday",
        is_optional: h.is_optional ?? false,
      })) as Holiday[];
    },
  });

  // 4. Fetch Leave Types
  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ["leave-types-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) return [];
      return (data as unknown as LeaveType[]) ?? [];
    },
  });

  // 5. Fetch Leave Balances for current user
  const { data: myBalances = [], isLoading: balancesLoading } = useQuery<LeaveBalance[]>({
    queryKey: ["my-leave-balances", session.employeeId, currentYear],
    enabled: Boolean(session.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(*)")
        .eq("employee_id", session.employeeId!)
        .eq("year", currentYear);
      if (error) return [];
      return (data as unknown as LeaveBalance[]) ?? [];
    },
  });

  // 6. Fetch All Leave Requests (for Calendar & user views)
  const { data: allRequests = [], isLoading: requestsLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["leave-requests", session.employeeId, session.isAdmin, session.isManager],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees(id, full_name, employee_code, department_id, departments(name)), leave_types(*)")
        .order("applied_at", { ascending: false });
      if (error) return [];
      return (data as unknown as LeaveRequest[]) ?? [];
    },
  });

  // 7. Fetch Employees for Admin direct grant
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-lookup-leave"],
    enabled: session.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, department_id, departments(name)")
        .order("full_name");
      if (error) return [];
      return data ?? [];
    },
  });

  // Current user's requests
  const myRequests = useMemo(() => {
    return allRequests.filter((r) => r.employee_id === session.employeeId);
  }, [allRequests, session.employeeId]);

  // Filtered requests for "My Leaves" tab
  const filteredMyRequests = useMemo(() => {
    return myRequests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const typeName = (r.leave_types?.name || "").toLowerCase();
        const reason = (r.reason || "").toLowerCase();
        return typeName.includes(q) || reason.includes(q);
      }
      return true;
    });
  }, [myRequests, statusFilter, searchQuery]);

  // Count pending approvals for badge
  const pendingApprovalsCount = useMemo(() => {
    if (!session.isAdmin && !session.isManager) return 0;
    return allRequests.filter((r) => {
      if (r.status !== "pending") return false;
      if (session.isAdmin) return true;
      if (session.isManager && r.current_approval_level === "manager" && r.manager_id === session.employeeId) {
        return true;
      }
      return false;
    }).length;
  }, [allRequests, session.isAdmin, session.isManager, session.employeeId]);

  // Cancel Leave Mutation (using transactional PostgreSQL function)
  const cancelLeaveMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("cancel_leave_transactional", {
        p_request_id: requestId,
        p_reason: reason || "Cancelled by employee",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Leave request cancelled successfully. Any deducted balance has been restored.");
      setCancelModalOpen(false);
      setCancelingRequest(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to cancel leave request");
    },
  });

  // Admin Direct Grant Leave Mutation
  const adminGrantLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!targetEmployeeId) throw new Error("Please select an employee");
      if (!grantLeaveTypeId) throw new Error("Please select a leave category");
      if (!grantFromDate || !grantToDate) throw new Error("Please select valid dates");

      const workingDays = calculateWorkingLeaveDays(
        grantFromDate,
        grantToDate,
        false,
        holidays,
        weeklyOffDays,
        sandwichRuleEnabled
      );

      if (workingDays.days <= 0) throw new Error("Selected range contains 0 working days");

      // Transactional submit + direct approval
      const { data: applyData, error: applyErr } = await supabase.rpc("apply_leave_transactional", {
        p_employee_id: targetEmployeeId,
        p_leave_type_id: grantLeaveTypeId,
        p_from_date: grantFromDate,
        p_to_date: grantToDate,
        p_days: workingDays.days,
        p_half_day: false,
        p_reason: grantReason.trim() || "Administrative direct grant",
      });

      if (applyErr) throw applyErr;
      const resJson = applyData as { request_id?: string; success?: boolean; error?: string };
      if (!resJson.request_id) throw new Error(resJson.error || "Failed to create leave grant");

      // Approve directly
      const { error: approveErr } = await supabase.rpc("approve_leave_transactional", {
        p_request_id: resJson.request_id,
        p_comment: "Direct grant approved by Administrator",
      });

      if (approveErr) throw approveErr;
    },
    onSuccess: () => {
      toast.success("Leave directly granted and approved successfully");
      setAdminAddModalOpen(false);
      setTargetEmployeeId("");
      setGrantReason("");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to grant leave");
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={[{ label: "Leave Requests" }]}
        title="Leave Management"
        badge={
          <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground text-[11px] font-semibold">
            Enterprise Engine
          </Badge>
        }
        description={
          session.isAdmin
            ? "Organization-wide leave ledger, multi-tier approvals, policy controls, and team attendance synchronization."
            : session.isManager
            ? "Team leave inbox, hierarchy sign-offs, calendar tracking, and personal leave balances."
            : "Track your leave quotas, submit applications, check multi-level approvals, and view team calendar."
        }
        actions={
          <>
            {session.isAdmin && (
              <Button
                variant="outline"
                className="flex-1 sm:flex-none gap-2 text-xs h-9"
                onClick={() => {
                  setTargetEmployeeId(employees[0]?.id || "");
                  setGrantLeaveTypeId(leaveTypes[0]?.id || "");
                  setGrantReason("");
                  setAdminAddModalOpen(true);
                }}
              >
                <UserCheck className="h-4 w-4" />
                Direct Grant Leave
              </Button>
            )}
            <Button
              className="flex-1 sm:flex-none gap-2 shadow-xs text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setApplyModalOpen(true)}
              disabled={!session.employeeId}
            >
              <PlusCircle className="h-4 w-4" />
              Apply for Leave
            </Button>
          </>
        }
      />

      {/* Leave Balances Grid (Top Overview) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            My Annual Entitlements ({currentYear})
          </span>
          {sandwichRuleEnabled && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" /> Sandwich Rule Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {balancesLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))
          ) : myBalances.length > 0 ? (
            myBalances.map((bal) => {
              const type = bal.leave_types;
              const usedPct = bal.total > 0 ? Math.min(100, Math.round((bal.used / bal.total) * 100)) : 0;
              const accentColor = type?.color || "#4f46e5";

              return (
                <Card
                  key={bal.id}
                  className="card-soft relative overflow-hidden transition-all duration-200 hover:shadow-md border"
                  style={{ borderTop: `3px solid ${accentColor}` }}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground line-clamp-1">
                            {type?.name || "Leave"}
                          </span>
                          {type?.code && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                              {type.code}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {type?.is_paid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 ${
                          bal.remaining > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {bal.remaining > 0 ? `${bal.remaining}d Left` : "Exhausted"}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tight text-foreground font-mono">
                          {bal.remaining}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          / {bal.total}d
                        </span>
                      </div>
                      {bal.carried_forward && bal.carried_forward > 0 ? (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium" title="Carried forward from previous cycle">
                          +{bal.carried_forward} cf
                        </span>
                      ) : null}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${usedPct}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                      <span>Used: <strong className="text-foreground">{bal.used}d</strong></span>
                      {type?.allow_encashment && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400">Encashable</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-full p-6 text-center text-muted-foreground border-dashed">
              <div className="max-w-md mx-auto space-y-2">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-medium">No leave balances allocated for {currentYear}.</p>
                <p className="text-[11px]">
                  {session.isAdmin
                    ? "Go to the 'Policies & Configuration' tab to allocate annual leave quotas for employees."
                    : "Your annual leave ledger has not been generated yet. Please contact your HR administrator."}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
          <TabsTrigger value="my-leaves" className="text-xs">
            My Leaves ({myRequests.length})
          </TabsTrigger>
          {(session.isManager || session.isAdmin) && (
            <TabsTrigger value="approvals" className="text-xs relative">
              Approvals Queue
              {pendingApprovalsCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {pendingApprovalsCount}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="calendar" className="text-xs">
            Team Calendar
          </TabsTrigger>
          {(session.isAdmin || session.isManager) && (
            <TabsTrigger value="policies" className="text-xs">
              Policies & Setup
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: My Leaves */}
        <TabsContent value="my-leaves" className="space-y-4">
          <Card className="card-soft">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-semibold">My Leave Applications & History</CardTitle>
                <CardDescription className="text-xs">
                  View application stages, approval trail, manager comments, and cancel pending requests.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-44">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search type/reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredMyRequests.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <CalendarDays className="mx-auto h-10 w-10 stroke-1 text-muted-foreground/60" />
                  <p className="font-semibold text-sm">No leave requests found</p>
                  <p className="text-xs">
                    {searchQuery || statusFilter !== "all"
                      ? "Try clearing filters to view all records."
                      : "You haven't submitted any leave applications yet."}
                  </p>
                  {!searchQuery && statusFilter === "all" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs"
                      onClick={() => setApplyModalOpen(true)}
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" /> Apply Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 uppercase tracking-wider text-[11px] text-muted-foreground">
                        <th className="py-3 px-3.5 font-semibold">Leave Type</th>
                        <th className="py-3 px-3.5 font-semibold">Duration & Dates</th>
                        <th className="py-3 px-3.5 font-semibold">Net Days</th>
                        <th className="py-3 px-3.5 font-semibold">Reason & Proof</th>
                        <th className="py-3 px-3.5 font-semibold">Approval Status</th>
                        <th className="py-3 px-3.5 font-semibold">Reviewer Notes</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredMyRequests.map((req) => {
                        const statusBadge = getLeaveRequestDisplayStatus(req);
                        const isPending = req.status === "pending";
                        const isApproved = req.status === "approved";
                        const canCancel = isPending || (isApproved && req.from_date >= toDateKey(new Date()));

                        return (
                          <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                            {/* Type */}
                            <td className="py-3.5 px-3.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: req.leave_types?.color || "#4f46e5" }}
                                />
                                <div>
                                  <span className="font-semibold text-foreground">
                                    {req.leave_types?.name || "Leave"}
                                  </span>
                                  {req.leave_types?.code && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                      ({req.leave_types.code})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Duration */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-mono text-muted-foreground">
                                {formatDate(req.from_date)} → {formatDate(req.to_date)}
                              </div>
                              {req.half_day && (
                                <Badge variant="outline" className="mt-0.5 text-[9px] px-1 py-0 text-primary border-primary/30">
                                  {req.half_day_period === "first_half" ? "First Half (Morning)" : "Second Half (Afternoon)"}
                                </Badge>
                              )}
                            </td>

                            {/* Net Days */}
                            <td className="py-3.5 px-3.5 font-mono font-bold text-foreground">
                              {req.days}d
                            </td>

                            {/* Reason & Proof */}
                            <td className="py-3.5 px-3.5 max-w-[200px]">
                              <p className="truncate text-muted-foreground" title={req.reason || ""}>
                                {req.reason || "—"}
                              </p>
                              {req.attachment_url && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const { data } = await supabase.storage
                                      .from("leave-attachments")
                                      .createSignedUrl(req.attachment_url!, 3600);
                                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                >
                                  <FileText className="h-3 w-3" /> Attached Proof
                                </button>
                              )}
                            </td>

                            {/* Approval Status */}
                            <td className="py-3.5 px-3.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  statusBadge.colorClass
                                }`}
                              >
                                {statusBadge.label}
                              </span>
                            </td>

                            {/* Reviewer Notes */}
                            <td className="py-3.5 px-3.5 max-w-[180px]">
                              {req.manager_comment && (
                                <p className="text-[10px] text-muted-foreground truncate" title={req.manager_comment}>
                                  <strong>Manager:</strong> {req.manager_comment}
                                </p>
                              )}
                              {req.admin_comment && (
                                <p className="text-[10px] text-muted-foreground truncate" title={req.admin_comment}>
                                  <strong>HR:</strong> {req.admin_comment}
                                </p>
                              )}
                              {!req.manager_comment && !req.admin_comment && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  {isPending ? "Awaiting review" : "—"}
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-3.5 text-right">
                              {canCancel ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                                  onClick={() => {
                                    setCancelingRequest(req);
                                    setCancelReason("");
                                    setCancelModalOpen(true);
                                  }}
                                >
                                  <Ban className="h-3 w-3 mr-1" /> Cancel
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  {req.status === "cancelled" ? "Cancelled" : "Completed"}
                                </span>
                              )}
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
        </TabsContent>

        {/* TAB 2: Approvals Queue */}
        {(session.isManager || session.isAdmin) && (
          <TabsContent value="approvals" className="space-y-4">
            <LeaveApprovalsManager
              currentEmployeeId={session.employeeId}
              isAdmin={session.isAdmin}
              isManager={session.isManager}
              departmentId={session.departmentId}
            />
          </TabsContent>
        )}

        {/* TAB 3: Team Leave Calendar */}
        <TabsContent value="calendar" className="space-y-4">
          <TeamLeaveCalendarView
            leaveRequests={allRequests}
            holidays={holidays}
            leaveTypes={leaveTypes}
            weeklyOffDays={weeklyOffDays}
          />
        </TabsContent>

        {/* TAB 4: Policies & Configuration */}
        {(session.isAdmin || session.isManager) && (
          <TabsContent value="policies" className="space-y-4">
            <LeavePolicyConfigManager organizationId={null} />
          </TabsContent>
        )}
      </Tabs>

      {/* Apply Leave Dialog */}
      <ApplyLeaveDialog
        open={applyModalOpen}
        onOpenChange={setApplyModalOpen}
        employeeId={session.employeeId || ""}
        leaveBalances={myBalances}
        existingRequests={myRequests}
        holidays={holidays}
        weeklyOffDays={weeklyOffDays}
        sandwichRuleEnabled={sandwichRuleEnabled}
      />

      {/* Cancel Leave Confirmation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" /> Cancel Leave Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel this leave application?
              {cancelingRequest?.status === "approved" && (
                <span className="block mt-1 font-semibold text-amber-600 dark:text-amber-400">
                  ⚠️ This leave is currently approved. Canceling will restore {cancelingRequest.days} day(s) to your balance and remove corresponding leave attendance records.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <p>
                <strong>Type:</strong> {cancelingRequest?.leave_types?.name}
              </p>
              <p>
                <strong>Dates:</strong> {cancelingRequest && formatDate(cancelingRequest.from_date)} →{" "}
                {cancelingRequest && formatDate(cancelingRequest.to_date)} ({cancelingRequest?.days} working days)
              </p>
              {cancelingRequest?.reason && (
                <p>
                  <strong>Original Reason:</strong> {cancelingRequest.reason}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Cancellation (Optional)</Label>
              <Input
                placeholder="e.g. Plans changed / postponed"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)} className="text-xs h-8">
              Keep Request
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (cancelingRequest) {
                  cancelLeaveMutation.mutate({
                    requestId: cancelingRequest.id,
                    reason: cancelReason,
                  });
                }
              }}
              disabled={cancelLeaveMutation.isPending}
              className="text-xs h-8 gap-1.5"
            >
              {cancelLeaveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Direct Grant Modal */}
      {session.isAdmin && (
        <Dialog open={adminAddModalOpen} onOpenChange={setAdminAddModalOpen}>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600" /> Direct Grant Leave
              </DialogTitle>
              <DialogDescription className="text-xs">
                Administratively assign and approve a leave for any employee. Balances will be deducted and attendance automatically synchronized.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Select Employee</Label>
                <Select value={targetEmployeeId} onValueChange={setTargetEmployeeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Leave Category</Label>
                <Select value={grantLeaveTypeId} onValueChange={setGrantLeaveTypeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt) => (
                      <SelectItem key={lt.id} value={lt.id}>
                        {lt.name} ({lt.is_paid ? "Paid" : "Unpaid"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={grantFromDate}
                    onChange={(e) => {
                      setGrantFromDate(e.target.value);
                      if (e.target.value > grantToDate) setGrantToDate(e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={grantToDate}
                    min={grantFromDate}
                    onChange={(e) => setGrantToDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-2.5 text-xs space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Net Working Days:</span>
                  <span className="text-primary font-mono font-bold">
                    {calculateWorkingLeaveDays(grantFromDate, grantToDate, false, holidays, weeklyOffDays, sandwichRuleEnabled).days} days
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Administrative Grant Note</Label>
                <Input
                  placeholder="e.g. Bereavement / Special emergency granted by management"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setAdminAddModalOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => adminGrantLeaveMutation.mutate()}
                disabled={adminGrantLeaveMutation.isPending || !targetEmployeeId || !grantLeaveTypeId}
                className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {adminGrantLeaveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Direct Grant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
