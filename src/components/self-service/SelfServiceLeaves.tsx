import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Ban,
  Loader2,
  FileText,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  calculateWorkingLeaveDays,
  checkLeaveOverlap,
  getLeaveRequestDisplayStatus,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Holiday,
  type LeavePolicy,
} from "@/lib/leave";
import { toDateKey, formatDate } from "@/lib/attendance";
import { ApplyLeaveDialog } from "@/components/leaves/ApplyLeaveDialog";

interface SelfServiceLeavesProps {
  employeeId: string;
}

export function SelfServiceLeaves({ employeeId }: SelfServiceLeavesProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // 1. Fetch Organization Leave Policy
  const { data: leavePolicy } = useQuery({
    queryKey: ["leave-policy-self-service"],
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
    queryKey: ["app-settings-self-service-leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) return null;
      return data ?? null;
    },
  });

  const weeklyOffDays = (leavePolicy?.weekly_off_days as number[]) || (appSettings?.weekly_off_days as number[]) || [0, 6];
  const sandwichRuleEnabled = leavePolicy?.sandwich_rule_enabled ?? false;

  // 3. Query holidays
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays-self-service", currentYear],
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

  // 4. Query leave balances for current employee
  const { data: balances = [], isLoading: balancesLoading } = useQuery<LeaveBalance[]>({
    queryKey: ["my-leave-balances", employeeId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(*)")
        .eq("employee_id", employeeId)
        .eq("year", currentYear);
      if (error) throw error;
      return (data as unknown as LeaveBalance[]) ?? [];
    },
    enabled: Boolean(employeeId),
  });

  // 5. Query leave requests history for current employee
  const { data: requests = [], isLoading: requestsLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["my-leave-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, leave_types(*)")
        .eq("employee_id", employeeId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as LeaveRequest[]) ?? [];
    },
    enabled: Boolean(employeeId),
  });

  // Cancel leave request mutation (transactional function)
  const cancelMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("cancel_leave_transactional", {
        p_request_id: requestId,
        p_reason: reason || "Cancelled by employee",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Leave application cancelled. Any balance deducted has been restored.");
      setCancelModalOpen(false);
      setCancelingRequest(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to cancel request");
    },
  });

  return (
    <div className="space-y-6">
      {/* Balances Section */}
      <Card className="card-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2 font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" /> Leave Entitlements ({currentYear})
                </CardTitle>
                {sandwichRuleEnabled && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/40">
                    <Sparkles className="h-2.5 w-2.5 mr-1" /> Sandwich Rule Active
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Your allocated annual quotas, utilized days, carry-forward, and real-time remaining balances.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setApplyModalOpen(true)}
              className="gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              disabled={!employeeId}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Apply for Leave
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {balancesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg p-4">
              No leave balance records found for {currentYear}. Please contact your HR administrator.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {balances.map((b) => {
                const total = b.total || 0;
                const used = b.used || 0;
                const remaining = b.remaining;
                const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                const typeColor = b.leave_types?.color || "#4f46e5";

                return (
                  <div
                    key={b.id}
                    className="rounded-lg border p-3.5 space-y-2 bg-card relative overflow-hidden transition-all hover:shadow-sm"
                    style={{ borderTop: `3px solid ${typeColor}` }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {b.leave_types?.name || "Leave"}
                        </span>
                        {b.leave_types?.code && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                            {b.leave_types.code}
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 ${
                          remaining > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {remaining > 0 ? `${remaining}d Left` : "Exhausted"}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <div className="flex items-baseline gap-1 font-mono">
                        <strong className="text-xl font-black text-foreground">{remaining}</strong>
                        <span className="text-[11px] text-muted-foreground">/ {total}d</span>
                      </div>
                      {b.carried_forward && b.carried_forward > 0 ? (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium" title="Carried forward from last year">
                          +{b.carried_forward} cf
                        </span>
                      ) : null}
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: typeColor,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                      <span>Used: <strong className="text-foreground">{used}d</strong></span>
                      {b.leave_types?.allow_encashment && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400">Encashable</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests History */}
      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4 text-primary" /> My Leave Requests & Approvals
          </CardTitle>
          <CardDescription className="text-xs">
            Multi-stage approval tracking, manager notes, and submission history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
              <Calendar className="mx-auto h-8 w-8 opacity-40 mb-1" />
              <p>You haven't submitted any leave requests yet.</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setApplyModalOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" /> Apply for Leave
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Leave Type</th>
                    <th className="py-2.5 px-3">Dates & Duration</th>
                    <th className="py-2.5 px-3">Days</th>
                    <th className="py-2.5 px-3">Reason & Proof</th>
                    <th className="py-2.5 px-3">Applied On</th>
                    <th className="py-2.5 px-3">Approval Status</th>
                    <th className="py-2.5 px-3">Reviewer Comments</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r) => {
                    const statusBadge = getLeaveRequestDisplayStatus(r);
                    const canCancel = r.status === "pending" || (r.status === "approved" && r.from_date >= toDateKey(new Date()));

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: r.leave_types?.color || "#4f46e5" }}
                            />
                            <span>{r.leave_types?.name || "Leave"}</span>
                            {r.leave_types?.code && (
                              <span className="text-[10px] text-muted-foreground">
                                ({r.leave_types.code})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-muted-foreground">
                            {formatDate(r.from_date)} {r.from_date !== r.to_date && `– ${formatDate(r.to_date)}`}
                          </span>
                          {r.half_day && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 text-primary border-primary/30">
                              {r.half_day_period === "first_half" ? "First Half" : "Second Half"}
                            </Badge>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-semibold font-mono">{r.days}d</td>

                        <td className="py-2.5 px-3 max-w-[180px]">
                          <p className="truncate text-muted-foreground" title={r.reason || ""}>
                            {r.reason || "—"}
                          </p>
                          {r.attachment_url && (
                            <button
                              type="button"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from("leave-attachments")
                                  .createSignedUrl(r.attachment_url!, 3600);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                            >
                              <FileText className="h-3 w-3" /> Proof Document
                            </button>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          {formatDate(r.applied_at.split("T")[0] || r.applied_at)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              statusBadge.colorClass
                            }`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 max-w-[160px]">
                          {r.manager_comment && (
                            <p className="text-[10px] text-muted-foreground truncate" title={r.manager_comment}>
                              <strong>Mgr:</strong> {r.manager_comment}
                            </p>
                          )}
                          {r.admin_comment && (
                            <p className="text-[10px] text-muted-foreground truncate" title={r.admin_comment}>
                              <strong>HR:</strong> {r.admin_comment}
                            </p>
                          )}
                          {!r.manager_comment && !r.admin_comment && (
                            <span className="text-[10px] text-muted-foreground italic">
                              {r.status === "pending" ? "In review" : "—"}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {canCancel ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              onClick={() => {
                                setCancelingRequest(r);
                                setCancelReason("");
                                setCancelModalOpen(true);
                              }}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              {r.status === "cancelled" ? "Cancelled" : "Decided"}
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

      {/* Apply Leave Dialog */}
      <ApplyLeaveDialog
        open={applyModalOpen}
        onOpenChange={setApplyModalOpen}
        employeeId={employeeId}
        leaveBalances={balances}
        existingRequests={requests}
        holidays={holidays}
        weeklyOffDays={weeklyOffDays}
        sandwichRuleEnabled={sandwichRuleEnabled}
      />

      {/* Cancel Request Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" /> Cancel Leave Application
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel this leave application?
              {cancelingRequest?.status === "approved" && (
                <span className="block mt-1 font-semibold text-amber-600 dark:text-amber-400">
                  ⚠️ This leave was approved. Cancelling will restore {cancelingRequest.days} day(s) to your balance and remove synced leave attendance records.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <p>
                <strong>Category:</strong> {cancelingRequest?.leave_types?.name}
              </p>
              <p>
                <strong>Dates:</strong> {cancelingRequest && formatDate(cancelingRequest.from_date)} →{" "}
                {cancelingRequest && formatDate(cancelingRequest.to_date)} ({cancelingRequest?.days} days)
              </p>
              {cancelingRequest?.reason && (
                <p>
                  <strong>Reason:</strong> {cancelingRequest.reason}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Cancellation (Optional)</Label>
              <Input
                placeholder="e.g. Personal schedule changed"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              className="text-xs h-8"
            >
              Keep Leave
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (cancelingRequest) {
                  cancelMutation.mutate({
                    requestId: cancelingRequest.id,
                    reason: cancelReason,
                  });
                }
              }}
              disabled={cancelMutation.isPending}
              className="text-xs h-8 gap-1.5"
            >
              {cancelMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
