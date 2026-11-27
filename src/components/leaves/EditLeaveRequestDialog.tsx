import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateWorkingLeaveDays,
  type Holiday,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave";

type LevelOption =
  | "pending_manager"
  | "pending_admin"
  | "approved"
  | "rejected"
  | "cancelled";

function toLevelOption(req: LeaveRequest | null): LevelOption {
  if (!req) return "pending_admin";
  if (req.status === "approved") return "approved";
  if (req.status === "rejected") return "rejected";
  if (req.status === "cancelled") return "cancelled";
  return req.current_approval_level === "manager" ? "pending_manager" : "pending_admin";
}

function fromLevelOption(option: LevelOption): {
  status: LeaveRequest["status"];
  current_approval_level: "manager" | "admin" | "completed";
} {
  switch (option) {
    case "pending_manager":
      return { status: "pending", current_approval_level: "manager" };
    case "pending_admin":
      return { status: "pending", current_approval_level: "admin" };
    case "approved":
      return { status: "approved", current_approval_level: "completed" };
    case "rejected":
      return { status: "rejected", current_approval_level: "completed" };
    case "cancelled":
      return { status: "cancelled", current_approval_level: "completed" };
  }
}

interface EditLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest | null;
  holidays?: Holiday[];
  weeklyOffDays?: number[];
  sandwichRuleEnabled?: boolean;
}

export function EditLeaveRequestDialog({
  open,
  onOpenChange,
  request,
  holidays = [],
  weeklyOffDays = [0, 6],
  sandwichRuleEnabled = false,
}: EditLeaveRequestDialogProps) {
  const queryClient = useQueryClient();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first_half" | "second_half">("first_half");
  const [days, setDays] = useState("1");
  const [levelOption, setLevelOption] = useState<LevelOption>("pending_admin");
  const [reason, setReason] = useState("");
  const [managerComment, setManagerComment] = useState("");
  const [adminComment, setAdminComment] = useState("");

  useEffect(() => {
    if (!request || !open) return;
    setLeaveTypeId(request.leave_type_id);
    setFromDate(request.from_date);
    setToDate(request.to_date);
    setHalfDay(Boolean(request.half_day));
    setHalfDayPeriod(request.half_day_period === "second_half" ? "second_half" : "first_half");
    setDays(String(request.days));
    setLevelOption(toLevelOption(request));
    setReason(request.reason || "");
    setManagerComment(request.manager_comment || "");
    setAdminComment(request.admin_comment || "");
  }, [request, open]);

  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ["leave-types-all"],
    enabled: open,
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

  function recomputeDays(nextFrom: string, nextTo: string, nextHalf: boolean) {
    const calc = calculateWorkingLeaveDays(
      nextFrom,
      nextTo,
      nextHalf,
      holidays,
      weeklyOffDays,
      sandwichRuleEnabled
    );
    if (calc.days > 0) setDays(String(calc.days));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error("No leave request selected");
      if (!leaveTypeId) throw new Error("Please select a leave type");
      if (!fromDate || !toDate || toDate < fromDate) {
        throw new Error("Please select a valid date range");
      }
      const parsedDays = parseFloat(days);
      if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
        throw new Error("Leave days must be greater than zero");
      }

      const target = fromLevelOption(levelOption);
      const { error } = await supabase.rpc("edit_leave_request_transactional", {
        p_request_id: request.id,
        p_leave_type_id: leaveTypeId,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_days: parsedDays,
        p_half_day: halfDay,
        p_half_day_period: halfDay ? halfDayPeriod : "full_day",
        p_reason: reason.trim() || null,
        p_status: target.status,
        p_current_approval_level: target.current_approval_level,
        p_manager_comment: managerComment.trim() || null,
        p_admin_comment: adminComment.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request updated and synced");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["admin-manager-leave-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-balances"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["team-leaves"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update leave request");
    },
  });

  const canHalfDay = fromDate && toDate && fromDate === toDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Edit2 className="h-4 w-4 text-primary" />
            Edit Leave Request
          </DialogTitle>
          <DialogDescription className="text-xs">
            {request?.employees?.full_name
              ? `Update leave details, dates, status, or approval level for ${request.employees.full_name}.`
              : "Update leave details, dates, status, or approval level. Balances and attendance sync automatically."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3.5 py-1 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Leave Category</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select category..." />
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Approval Level / Status</Label>
              <Select
                value={levelOption}
                onValueChange={(v) => setLevelOption(v as LevelOption)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_manager">Pending Manager Review</SelectItem>
                  <SelectItem value="pending_admin">Pending HR Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  const nextFrom = e.target.value;
                  const nextTo = nextFrom > toDate ? nextFrom : toDate;
                  const nextHalf = nextFrom === nextTo ? halfDay : false;
                  setFromDate(nextFrom);
                  if (nextFrom > toDate) setToDate(nextTo);
                  if (nextFrom !== nextTo) setHalfDay(false);
                  recomputeDays(nextFrom, nextTo, nextHalf);
                }}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">To Date</Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  const nextTo = e.target.value;
                  const nextHalf = fromDate === nextTo ? halfDay : false;
                  setToDate(nextTo);
                  if (fromDate !== nextTo) setHalfDay(false);
                  recomputeDays(fromDate, nextTo, nextHalf);
                }}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Net Days</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          {canHalfDay && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-2.5 bg-muted/20">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-leave-half-day"
                  checked={halfDay}
                  onCheckedChange={(checked) => {
                    const nextHalf = Boolean(checked);
                    setHalfDay(nextHalf);
                    recomputeDays(fromDate, toDate, nextHalf);
                  }}
                />
                <Label htmlFor="edit-leave-half-day" className="text-xs cursor-pointer">
                  Half Day
                </Label>
              </div>
              {halfDay && (
                <Select
                  value={halfDayPeriod}
                  onValueChange={(v) => setHalfDayPeriod(v as "first_half" | "second_half")}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_half">First Half (Morning)</SelectItem>
                    <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Leave Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Employee leave reason..."
              className="text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Manager Note</Label>
              <Input
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                placeholder="Manager comment..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">HR / Admin Note</Label>
              <Input
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="HR / Admin comment..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saveMutation.isPending}
              className="text-xs h-8 gap-1.5"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
