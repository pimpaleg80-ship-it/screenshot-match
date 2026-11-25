import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  FileText,
  Calendar,
  Search,
  Filter,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Building,
  User,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate } from "@/lib/attendance";
import {
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  getLeaveRequestDisplayStatus,
  type LeaveRequest,
} from "@/lib/leave";

interface LeaveApprovalsManagerProps {
  currentEmployeeId?: string | null;
  isAdmin: boolean;
  isManager: boolean;
  departmentId?: string | null;
}

export function LeaveApprovalsManager({
  currentEmployeeId,
  isAdmin,
  isManager,
  departmentId,
}: LeaveApprovalsManagerProps) {
  const queryClient = useQueryClient();

  const [filterScope, setFilterScope] = useState<"pending_my_action" | "all_pending" | "approved" | "rejected">("pending_my_action");
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "reject">("approve");
  const [decisionComment, setDecisionComment] = useState("");

  // Query Leave Requests with complete relations
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-manager-leave-approvals", currentEmployeeId, isAdmin],
    queryFn: async () => {
      const q = supabase
        .from("leave_requests")
        .select(`
          id, employee_id, leave_type_id, from_date, to_date, days, half_day, half_day_period,
          reason, attachment_url, status, current_approval_level,
          manager_id, manager_comment, manager_decision, manager_decision_at,
          admin_id, admin_comment, admin_decision, admin_decision_at,
          applied_at, decided_at, cancelled_at, cancellation_reason,
          employees!inner(id, full_name, employee_code, department_id, manager_id, departments(name)),
          leave_types(id, name, code, is_paid, color)
        `)
        .order("applied_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  // Extract departments
  const departments = useMemo(() => {
    return Array.from(
      new Set(requests.map((r) => r.employees?.departments?.name).filter(Boolean))
    ).sort() as string[];
  }, [requests]);

  // Filter requests based on role and tab
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Exclude own requests from approval queue
      if (currentEmployeeId && r.employee_id === currentEmployeeId) {
        return false;
      }

      // Department filter
      if (selectedDept !== "all" && r.employees?.departments?.name !== selectedDept) {
        return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const name = r.employees?.full_name?.toLowerCase() || "";
        const code = r.employees?.employee_code?.toLowerCase() || "";
        if (!name.includes(q) && !code.includes(q)) return false;
      }

      // Tab filter
      if (filterScope === "approved") {
        return r.status === "approved";
      }
      if (filterScope === "rejected") {
        return r.status === "rejected";
      }
      if (filterScope === "all_pending") {
        return r.status === "pending";
      }

      // pending_my_action
      if (r.status !== "pending") return false;

      if (isAdmin) {
        // Admins can act on any pending request (or specifically pending_admin)
        return true;
      }

      if (isManager && currentEmployeeId) {
        // Manager can act if they are the designated manager for this employee
        return (
          r.employees?.manager_id === currentEmployeeId &&
          (r.current_approval_level === "manager" || !r.current_approval_level)
        );
      }

      return false;
    });
  }, [requests, currentEmployeeId, isAdmin, isManager, filterScope, search, selectedDept]);

  // Approve Mutation (Transactional)
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) return;

      const { error } = await supabase.rpc("approve_leave_transactional", {
        p_request_id: selectedRequest.id,
        p_comment: decisionComment.trim() || null,
      });

      if (error) {
        // Fallback update if RPC not accessible
        const updatePayload: Record<string, unknown> = {
          status: "approved",
          decided_at: new Date().toISOString(),
        };
        if (isAdmin) {
          updatePayload["admin_id"] = currentEmployeeId;
          updatePayload["admin_comment"] = decisionComment.trim() || null;
          updatePayload["admin_decision"] = "approved";
          updatePayload["admin_decision_at"] = new Date().toISOString();
        } else {
          updatePayload["manager_id"] = currentEmployeeId;
          updatePayload["manager_comment"] = decisionComment.trim() || null;
          updatePayload["manager_decision"] = "approved";
          updatePayload["manager_decision_at"] = new Date().toISOString();
        }

        const { error: fallbackErr } = await (supabase
          .from("leave_requests") as any)
          .update(updatePayload)
          .eq("id", selectedRequest.id);

        if (fallbackErr) throw fallbackErr;
      }
    },
    onSuccess: () => {
      toast.success("Leave request approved successfully");
      setDecisionModalOpen(false);
      setSelectedRequest(null);
      setDecisionComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-manager-leave-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["team-leaves"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve leave request");
    },
  });

  // Reject Mutation (Transactional)
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) return;
      if (!decisionComment.trim()) throw new Error("A reason for rejection is required");

      const { error } = await supabase.rpc("reject_leave_transactional", {
        p_request_id: selectedRequest.id,
        p_comment: decisionComment.trim(),
      });

      if (error) {
        const updatePayload: Record<string, unknown> = {
          status: "rejected",
          decided_at: new Date().toISOString(),
        };
        if (isAdmin) {
          updatePayload["admin_id"] = currentEmployeeId;
          updatePayload["admin_comment"] = decisionComment.trim();
          updatePayload["admin_decision"] = "rejected";
        } else {
          updatePayload["manager_id"] = currentEmployeeId;
          updatePayload["manager_comment"] = decisionComment.trim();
          updatePayload["manager_decision"] = "rejected";
        }

        const { error: fallbackErr } = await (supabase
          .from("leave_requests") as any)
          .update(updatePayload)
          .eq("id", selectedRequest.id);

        if (fallbackErr) throw fallbackErr;
      }
    },
    onSuccess: () => {
      toast.success("Leave request rejected");
      setDecisionModalOpen(false);
      setSelectedRequest(null);
      setDecisionComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-manager-leave-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject leave request");
    },
  });

  function handleOpenDecision(req: LeaveRequest, type: "approve" | "reject") {
    setSelectedRequest(req);
    setDecisionType(type);
    setDecisionComment("");
    setDecisionModalOpen(true);
  }

  // Count pending items requiring action
  const pendingActionCount = useMemo(() => {
    return requests.filter((r) => {
      if (r.employee_id === currentEmployeeId || r.status !== "pending") return false;
      if (isAdmin) return true;
      if (isManager && currentEmployeeId) {
        return (
          r.employees?.manager_id === currentEmployeeId &&
          (r.current_approval_level === "manager" || !r.current_approval_level)
        );
      }
      return false;
    }).length;
  }, [requests, currentEmployeeId, isAdmin, isManager]);

  return (
    <div className="space-y-5">
      {/* Scope Filter Buttons & Search */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterScope === "pending_my_action" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterScope("pending_my_action")}
            className="text-xs h-8 gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Action
            {pendingActionCount > 0 && (
              <Badge className="ml-1 px-1.5 py-0 h-4 text-[10px] bg-rose-500 text-white">
                {pendingActionCount}
              </Badge>
            )}
          </Button>

          {isAdmin && (
            <Button
              variant={filterScope === "all_pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterScope("all_pending")}
              className="text-xs h-8 gap-1.5"
            >
              All Pending in Org
            </Button>
          )}

          <Button
            variant={filterScope === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterScope("approved")}
            className="text-xs h-8 gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Approved
          </Button>

          <Button
            variant={filterScope === "rejected" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterScope("rejected")}
            className="text-xs h-8 gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            Rejected
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center pt-2 border-t">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
              <Building className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Requests List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
              <h3 className="mt-3 text-base font-semibold">Approval queue is clear</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                There are no leave applications matching your current filter criteria.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredRequests.map((req) => {
                const statusMeta = getLeaveRequestDisplayStatus(req);
                return (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/15 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      {/* Employee Info Header */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                          {req.employees?.full_name?.slice(0, 2).toUpperCase() || "EM"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">
                              {req.employees?.full_name}
                            </h4>
                            <span className="font-mono text-xs text-muted-foreground">
                              ({req.employees?.employee_code})
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{
                                borderColor: req.leave_types?.color || undefined,
                                color: req.leave_types?.color || undefined,
                              }}
                            >
                              {req.leave_types?.name}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {req.employees?.departments?.name || "General"} • Applied on {formatDate(req.applied_at)}
                          </p>
                        </div>
                      </div>

                      {/* Dates & Duration */}
                      <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/20 p-2.5 rounded-lg border">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {formatDate(req.from_date)} → {formatDate(req.to_date)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs font-bold">
                          {req.days} {req.days === 1 ? "day" : "days"}
                        </Badge>
                        {req.half_day && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                            Half Day ({req.half_day_period === "second_half" ? "Afternoon" : "Morning"})
                          </Badge>
                        )}
                        {req.attachment_url && (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                          >
                            <FileText className="h-3 w-3" /> View Medical/Proof Document
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>

                      {/* Reason */}
                      {req.reason && (
                        <p className="text-xs text-muted-foreground italic pl-1">
                          "{req.reason}"
                        </p>
                      )}

                      {/* Approval Journey Stepper */}
                      <div className="flex items-center gap-2 text-[11px] pt-1">
                        <span className="text-muted-foreground">Workflow:</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Employee Applied
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant="secondary"
                            className={`text-[10px] gap-1 ${
                              req.manager_decision === "approved"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : req.manager_decision === "rejected"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {req.manager_decision === "approved" ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <Clock className="h-2.5 w-2.5" />
                            )}
                            Manager {req.manager_decision || "Pending"}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant="secondary"
                            className={`text-[10px] gap-1 ${
                              req.admin_decision === "approved"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : req.admin_decision === "rejected"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {req.admin_decision === "approved" ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <ShieldCheck className="h-2.5 w-2.5" />
                            )}
                            HR Admin {req.admin_decision || "Pending"}
                          </Badge>
                        </div>
                      </div>

                      {/* Decision Notes */}
                      {(req.manager_comment || req.admin_comment) && (
                        <div className="text-[11px] bg-muted/40 p-2 rounded border space-y-0.5">
                          {req.manager_comment && (
                            <p>
                              <strong className="text-foreground">Manager note:</strong> {req.manager_comment}
                            </p>
                          )}
                          {req.admin_comment && (
                            <p>
                              <strong className="text-foreground">HR note:</strong> {req.admin_comment}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 shrink-0">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.colorClass}`}>
                        {statusMeta.label}
                      </span>

                      {req.status === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenDecision(req, "approve")}
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isAdmin ? "Final Approve" : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDecision(req, "reject")}
                            className="h-8 border-rose-300 text-rose-600 hover:bg-rose-50 text-xs gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {decisionType === "approve" ? "Approve Leave Application" : "Reject Leave Application"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {decisionType === "approve"
                ? `Grant approval for ${selectedRequest?.employees?.full_name}'s ${selectedRequest?.days} day ${selectedRequest?.leave_types?.name}.`
                : `Specify why ${selectedRequest?.employees?.full_name}'s leave application is being rejected.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1">
              <div>
                <strong>Employee:</strong> {selectedRequest?.employees?.full_name} ({selectedRequest?.employees?.employee_code})
              </div>
              <div>
                <strong>Duration:</strong> {selectedRequest?.days} days ({formatDate(selectedRequest?.from_date || "")} → {formatDate(selectedRequest?.to_date || "")})
              </div>
              {selectedRequest?.reason && (
                <div>
                  <strong>Reason:</strong> {selectedRequest.reason}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {decisionType === "approve" ? "Management Comment (Optional)" : "Reason for Rejection (Required)"}
              </Label>
              <Textarea
                placeholder={
                  decisionType === "approve"
                    ? "Add any handover notes or coverage instructions..."
                    : "Explain why this leave application cannot be approved..."
                }
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                rows={3}
                className="text-xs resize-none"
                required={decisionType === "reject"}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDecisionModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (decisionType === "approve") {
                  approveMutation.mutate();
                } else {
                  rejectMutation.mutate();
                }
              }}
              disabled={
                approveMutation.isPending ||
                rejectMutation.isPending ||
                (decisionType === "reject" && !decisionComment.trim())
              }
              className={`text-xs h-8 gap-1.5 ${
                decisionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {decisionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
