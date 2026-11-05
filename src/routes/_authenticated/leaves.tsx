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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  calculateWorkingLeaveDays,
  checkLeaveOverlap,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type LeaveBalance,
  type Holiday,
} from "@/lib/leave";
import { toDateKey, formatDate } from "@/lib/attendance";
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
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/leaves")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Leave Management — Flowpeople by Fluxora" },
      { name: "description", content: "Apply for leaves, track balances, and manage approvals." },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("my-leaves");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [adminAddModalOpen, setAdminAddModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [decisionType, setDecisionType] = useState<"approved" | "rejected">("approved");
  const [decisionComment, setDecisionComment] = useState("");

  // Leave application form state
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(toDateKey(new Date()));
  const [toDate, setToDate] = useState<string>(toDateKey(new Date()));
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 1. Fetch settings (for weekly off days & approval flow)
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data ?? { weekly_off_days: [0], approval_flow: "manager_then_admin" };
    },
  });

  const weeklyOffDays = (appSettings?.weekly_off_days as number[]) || [0];

  // 2. Fetch Holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays").select("date, title").order("date");
      if (error) throw error;
      return (data as Holiday[]) ?? [];
    },
  });

  // 3. Fetch Leave Types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_types").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Fetch Employees (for Admin/Manager lookups)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-lookup"],
    enabled: session.isAdmin || session.isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, department_id, manager_id, departments(name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 5. Fetch Leave Balances for current user
  const currentYear = new Date().getFullYear();
  const { data: myBalances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["my-leave-balances", session.employeeId, currentYear],
    enabled: Boolean(session.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(*)")
        .eq("employee_id", session.employeeId!)
        .eq("year", currentYear);
      if (error) throw error;
      return (data as LeaveBalance[]) ?? [];
    },
  });

  // 6. Fetch Leave Requests
  const { data: allRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["leave-requests", session.roles, session.employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees(id, full_name, employee_code, department_id, departments(name)), leave_types(*)")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as LeaveRequest[]) ?? [];
    },
  });

  // Calculate day count preview
  const calculatedDays = useMemo(() => {
    return calculateWorkingLeaveDays(fromDate, toDate, halfDay, holidays, weeklyOffDays);
  }, [fromDate, toDate, halfDay, holidays, weeklyOffDays]);

  // Selected leave type balance
  const selectedBalance = useMemo(() => {
    return myBalances.find((b) => b.leave_type_id === leaveTypeId);
  }, [myBalances, leaveTypeId]);

  // Check if balance allows submission
  const isBalanceExceeded = Boolean(
    selectedBalance &&
    selectedBalance.leave_types?.is_paid &&
    calculatedDays.days > selectedBalance.remaining
  );

  // My requests vs Team vs All
  const myRequests = useMemo(() => {
    return allRequests.filter((r) => r.employee_id === session.employeeId);
  }, [allRequests, session.employeeId]);

  const teamRequests = useMemo(() => {
    if (!session.isManager && !session.isAdmin) return [];
    return allRequests.filter((r) => r.employee_id !== session.employeeId);
  }, [allRequests, session.employeeId, session.isManager, session.isAdmin]);

  // Apply Leave Mutation
  const applyLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!session.employeeId) throw new Error("Employee profile not found");
      if (!leaveTypeId) throw new Error("Please select a leave type");
      if (calculatedDays.days <= 0) throw new Error("No working leave days in selected date range");
      if (isBalanceExceeded) throw new Error("Insufficient leave balance for this request");

      // Check overlap
      const hasOverlap = checkLeaveOverlap(fromDate, toDate, myRequests);
      if (hasOverlap) throw new Error("Leave dates overlap with another pending or approved request");

      let attachmentUrl: string | null = null;
      if (attachmentFile && session.user) {
        const fileExt = attachmentFile.name.split(".").pop();
        const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from("leave-attachments")
          .upload(filePath, attachmentFile);
        if (uploadErr) throw new Error("Attachment upload failed: " + uploadErr.message);
        attachmentUrl = filePath;
      }

      // Check manager assignment
      const currentEmp = employees.find((e) => e.id === session.employeeId);
      const managerId = currentEmp?.manager_id ?? null;

      const { error } = await supabase.from("leave_requests").insert({
        employee_id: session.employeeId,
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        days: calculatedDays.days,
        half_day: halfDay,
        reason: reason.trim() || null,
        attachment_url: attachmentUrl,
        status: "pending",
        manager_id: managerId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted successfully");
      setApplyModalOpen(false);
      setReason("");
      setAttachmentFile(null);
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit leave request");
    },
  });

  // Cancel Leave Mutation (by employee while pending)
  const cancelLeaveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("employee_id", session.employeeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request cancelled");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to cancel leave request");
    },
  });

  // Decide Leave Mutation (by Manager or Admin)
  const decideLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) return;

      const isMgr = session.isManager;
      const isAdmin = session.isAdmin;

      const updatePayload: Record<string, unknown> = {
        status: decisionType,
        decided_at: new Date().toISOString(),
      };

      if (isAdmin) {
        updatePayload.admin_id = session.employeeId;
        updatePayload.admin_comment = decisionComment.trim() || null;
      } else if (isMgr) {
        updatePayload.manager_id = session.employeeId;
        updatePayload.manager_comment = decisionComment.trim() || null;
      }

      const { error } = await supabase
        .from("leave_requests")
        .update(updatePayload)
        .eq("id", selectedRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Leave request ${decisionType}`);
      setDecisionModalOpen(false);
      setSelectedRequest(null);
      setDecisionComment("");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to process leave decision");
    },
  });

  // Admin Direct Grant Leave Mutation
  const adminGrantLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!targetEmployeeId) throw new Error("Please select an employee");
      if (!leaveTypeId) throw new Error("Please select a leave type");
      if (calculatedDays.days <= 0) throw new Error("No working days in range");

      const { error } = await supabase.from("leave_requests").insert({
        employee_id: targetEmployeeId,
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        days: calculatedDays.days,
        half_day: halfDay,
        reason: reason.trim() || "Administrative grant",
        status: "approved",
        admin_id: session.employeeId,
        admin_comment: "Granted directly by Administrator",
        decided_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave directly granted and recorded");
      setAdminAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to grant leave");
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-sm text-muted-foreground">
            {session.isAdmin
              ? "Organization-wide leave ledger, approvals, and balance controls"
              : session.isManager
              ? "Team leave inbox, approvals, and personal leave requests"
              : "Track your leave balances, apply for leaves, and view past requests"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.isAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setTargetEmployeeId("");
                setReason("");
                setAdminAddModalOpen(true);
              }}
            >
              <UserCheck className="h-4 w-4" />
              Direct Grant Leave
            </Button>
          )}
          <Button
            className="gap-2 shadow-soft"
            onClick={() => {
              setLeaveTypeId(leaveTypes[0]?.id || "");
              setReason("");
              setApplyModalOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4" />
            Apply Leave
          </Button>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {balancesLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : myBalances.length > 0 ? (
          myBalances.map((bal) => (
            <Card key={bal.id} className="card-soft relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {bal.leave_types?.name || "Leave"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {bal.leave_types?.is_paid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">{bal.remaining}</span>
                  <span className="text-xs text-muted-foreground">/ {bal.total} days</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${bal.total > 0 ? Math.min(100, (bal.used / bal.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>Used: {bal.used}d</span>
                  <span>Rem: {bal.remaining}d</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full p-6 text-center text-muted-foreground">
            No active leave balance ledger assigned for {currentYear}. Contact your HR administrator.
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 sm:grid-cols-3">
          <TabsTrigger value="my-leaves">My Leaves ({myRequests.length})</TabsTrigger>
          {(session.isManager || session.isAdmin) && (
            <TabsTrigger value="team-requests">
              Team Approvals ({teamRequests.filter((r) => r.status === "pending").length})
            </TabsTrigger>
          )}
          <TabsTrigger value="calendar">Leave Calendar</TabsTrigger>
        </TabsList>

        {/* TAB 1: My Leaves */}
        <TabsContent value="my-leaves" className="space-y-4">
          <Card className="card-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">My Leave History</CardTitle>
                <CardDescription>All submitted leave requests and their current decision status.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : myRequests.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CalendarDays className="mx-auto mb-3 h-10 w-10 stroke-1 text-muted-foreground/60" />
                  <p className="font-medium">No leave requests found</p>
                  <p className="text-xs">You haven't submitted any leave requests yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Duration</th>
                        <th className="pb-3 font-semibold">Days</th>
                        <th className="pb-3 font-semibold">Reason</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Decision / Comments</th>
                        <th className="pb-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {myRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3.5 font-medium">{req.leave_types?.name || "Leave"}</td>
                          <td className="py-3.5 text-xs text-muted-foreground">
                            {formatDate(req.from_date)} → {formatDate(req.to_date)}
                            {req.half_day && <span className="ml-1 font-semibold text-primary">(Half day)</span>}
                          </td>
                          <td className="py-3.5 font-semibold">{req.days}d</td>
                          <td className="py-3.5 max-w-xs truncate text-xs text-muted-foreground">
                            {req.reason || "—"}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                LEAVE_STATUS_COLORS[req.status] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {LEAVE_STATUS_LABELS[req.status] || req.status}
                            </span>
                          </td>
                          <td className="py-3.5 max-w-xs text-xs text-muted-foreground">
                            {req.admin_comment || req.manager_comment || "Pending review"}
                          </td>
                          <td className="py-3.5 text-right">
                            {req.status === "pending" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => cancelLeaveMutation.mutate(req.id)}
                                disabled={cancelLeaveMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Team Approvals */}
        {(session.isManager || session.isAdmin) && (
          <TabsContent value="team-requests" className="space-y-4">
            <Card className="card-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Team Leave Requests</CardTitle>
                  <CardDescription>
                    {session.isAdmin
                      ? "Organization-wide approval queue. Final sign-off updates attendance and deducts balance."
                      : "Direct team requests awaiting your manager decision."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {teamRequests.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500/60" />
                    <p className="font-medium">No team requests in queue</p>
                    <p className="text-xs">All pending team leaves have been decided.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="pb-3 font-semibold">Employee</th>
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Dates</th>
                          <th className="pb-3 font-semibold">Days</th>
                          <th className="pb-3 font-semibold">Reason</th>
                          <th className="pb-3 font-semibold">Status</th>
                          <th className="pb-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {teamRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-3.5">
                              <p className="font-semibold text-foreground">
                                {req.employees?.full_name || "Employee"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {req.employees?.employee_code} • {req.employees?.departments?.name || "General"}
                              </p>
                            </td>
                            <td className="py-3.5 font-medium">{req.leave_types?.name}</td>
                            <td className="py-3.5 text-xs text-muted-foreground">
                              {formatDate(req.from_date)} → {formatDate(req.to_date)}
                            </td>
                            <td className="py-3.5 font-semibold">{req.days}d</td>
                            <td className="py-3.5 max-w-xs truncate text-xs text-muted-foreground">
                              {req.reason || "—"}
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  LEAVE_STATUS_COLORS[req.status] || "bg-muted text-muted-foreground"
                                }`}
                              >
                                {LEAVE_STATUS_LABELS[req.status] || req.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              {req.status === "pending" ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-8 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setDecisionType("approved");
                                      setDecisionComment("");
                                      setDecisionModalOpen(true);
                                    }}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-rose-300 text-xs text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setDecisionType("rejected");
                                      setDecisionComment("");
                                      setDecisionModalOpen(true);
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Decided</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* TAB 3: Leave Calendar */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="card-soft">
            <CardHeader>
              <CardTitle className="text-base">Upcoming Leaves & Holidays</CardTitle>
              <CardDescription>
                Overview of planned employee leaves and official company holidays.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Holidays column */}
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Official Holidays ({holidays.length})
                    </h3>
                    <div className="space-y-2">
                      {holidays.map((h) => (
                        <div
                          key={h.date}
                          className="flex items-center justify-between rounded-lg border bg-background p-2.5 text-xs shadow-soft"
                        >
                          <span className="font-semibold text-foreground">{h.title}</span>
                          <span className="text-muted-foreground font-mono">{formatDate(h.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active approved leaves column */}
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      Approved Team Leaves
                    </h3>
                    <div className="space-y-2">
                      {allRequests
                        .filter((r) => r.status === "approved")
                        .slice(0, 8)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-lg border bg-background p-2.5 text-xs shadow-soft"
                          >
                            <div>
                              <p className="font-semibold text-foreground">
                                {r.employees?.full_name || "Employee"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.leave_types?.name} ({r.days}d)
                              </p>
                            </div>
                            <span className="text-muted-foreground font-mono">
                              {formatDate(r.from_date)} → {formatDate(r.to_date)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Apply Leave */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Submit a formal leave request. Working days are computed automatically, skipping weekly offs
              and official holidays.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger id="leave-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => {
                    const bal = myBalances.find((b) => b.leave_type_id === lt.id);
                    return (
                      <SelectItem key={lt.id} value={lt.id}>
                        {lt.name} (Remaining: {bal ? bal.remaining : lt.days_per_year}d)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="from-date">From Date</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    if (e.target.value > toDate) setToDate(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">To Date</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="half-day"
                checked={halfDay}
                onCheckedChange={(c) => setHalfDay(Boolean(c))}
              />
              <Label htmlFor="half-day" className="cursor-pointer text-xs font-normal">
                Apply as Half Day (0.5 working day)
              </Label>
            </div>

            {/* Calculated Breakdown Card */}
            <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span>Working Days to Deduct:</span>
                <span className="text-primary text-sm font-bold">{calculatedDays.days} days</span>
              </div>
              {calculatedDays.excludedWeeklyOffs > 0 && (
                <p className="text-muted-foreground">
                  • {calculatedDays.excludedWeeklyOffs} weekly off(s) automatically excluded
                </p>
              )}
              {calculatedDays.excludedHolidays > 0 && (
                <p className="text-muted-foreground">
                  • {calculatedDays.excludedHolidays} official holiday(s) automatically excluded
                </p>
              )}
              {isBalanceExceeded && (
                <p className="text-rose-600 font-semibold pt-1">
                  ⚠️ Insufficient balance! You have only {selectedBalance?.remaining}d remaining for{" "}
                  {selectedBalance?.leave_types?.name}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Purpose</Label>
              <Input
                id="reason"
                placeholder="Reason for leave request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Supporting Document (Optional)</Label>
              <Input
                id="attachment"
                type="file"
                className="text-xs"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => applyLeaveMutation.mutate()}
              disabled={applyLeaveMutation.isPending || isBalanceExceeded || calculatedDays.days <= 0}
            >
              {applyLeaveMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manager / Admin Approval Decision */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "approved" ? "Approve Leave Request" : "Reject Leave Request"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.employees?.full_name} ({selectedRequest?.days} days,{" "}
              {selectedRequest?.leave_types?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Reason provided: <span className="font-medium text-foreground">{selectedRequest?.reason || "—"}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="decision-comment">Comments / Feedback</Label>
              <Input
                id="decision-comment"
                placeholder={
                  decisionType === "approved"
                    ? "Optional approval comment..."
                    : "Specify reason for rejection..."
                }
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className={
                decisionType === "approved"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }
              onClick={() => decideLeaveMutation.mutate()}
              disabled={decideLeaveMutation.isPending}
            >
              {decideLeaveMutation.isPending ? "Processing..." : `Confirm ${decisionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Admin Direct Grant Leave */}
      {session.isAdmin && (
        <Dialog open={adminAddModalOpen} onOpenChange={setAdminAddModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Direct Grant Leave</DialogTitle>
              <DialogDescription>
                Administratively assign and approve a leave for any employee.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="admin-emp">Select Employee</Label>
                <Select value={targetEmployeeId} onValueChange={setTargetEmployeeId}>
                  <SelectTrigger id="admin-emp">
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

              <div className="space-y-2">
                <Label htmlFor="admin-leave-type">Leave Type</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger id="admin-leave-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt) => (
                      <SelectItem key={lt.id} value={lt.id}>
                        {lt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-from-date">From Date</Label>
                  <Input
                    id="admin-from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-to-date">To Date</Label>
                  <Input
                    id="admin-to-date"
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Net Working Days:</span>
                  <span className="text-primary">{calculatedDays.days} days</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-reason">Administrative Note</Label>
                <Input
                  id="admin-reason"
                  placeholder="e.g. Special bereavement / official duty"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAdminAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => adminGrantLeaveMutation.mutate()}
                disabled={adminGrantLeaveMutation.isPending || !targetEmployeeId || !leaveTypeId}
              >
                {adminGrantLeaveMutation.isPending ? "Granting..." : "Confirm Grant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

