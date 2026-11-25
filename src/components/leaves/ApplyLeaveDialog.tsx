import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import {
  calculateWorkingLeaveDays,
  checkLeaveOverlap,
  type LeaveType,
  type LeaveBalance,
  type Holiday,
  type LeaveRequest,
} from "@/lib/leave";
import { toDateKey, formatDate } from "@/lib/attendance";

interface ApplyLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  leaveBalances: LeaveBalance[];
  existingRequests: LeaveRequest[];
  holidays: Holiday[];
  weeklyOffDays?: number[];
  sandwichRuleEnabled?: boolean;
}

export function ApplyLeaveDialog({
  open,
  onOpenChange,
  employeeId,
  leaveBalances,
  existingRequests,
  holidays,
  weeklyOffDays = [0, 6],
  sandwichRuleEnabled = false,
}: ApplyLeaveDialogProps) {
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(todayKey);
  const [toDate, setToDate] = useState<string>(todayKey);
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first_half" | "second_half">("first_half");
  const [reason, setReason] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Fetch active leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types-active-modal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) return [];
      return (data ?? []) as LeaveType[];
    },
  });

  // Selected leave type details
  const selectedType = useMemo(() => {
    return leaveTypes.find((lt) => lt.id === leaveTypeId);
  }, [leaveTypes, leaveTypeId]);

  // Balance for selected leave type
  const selectedBalance = useMemo(() => {
    return leaveBalances.find((b) => b.leave_type_id === leaveTypeId);
  }, [leaveBalances, leaveTypeId]);

  // Calculate working days preview
  const dayCalculation = useMemo(() => {
    return calculateWorkingLeaveDays(
      fromDate,
      toDate,
      halfDay,
      holidays,
      weeklyOffDays,
      sandwichRuleEnabled
    );
  }, [fromDate, toDate, halfDay, holidays, weeklyOffDays, sandwichRuleEnabled]);

  // Overlap verification
  const hasOverlap = useMemo(() => {
    return checkLeaveOverlap(fromDate, toDate, existingRequests);
  }, [fromDate, toDate, existingRequests]);

  // Check if balance is exceeded for paid leaves
  const isBalanceExceeded = Boolean(
    selectedType?.is_paid &&
      selectedBalance &&
      dayCalculation.days > selectedBalance.remaining
  );

  // Document proof required check
  const isProofRequired = Boolean(
    selectedType?.requires_document_proof &&
      dayCalculation.days >= (selectedType?.document_proof_min_days ?? 2)
  );

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Employee ID required");
      if (!leaveTypeId) throw new Error("Please select a leave category");
      if (dayCalculation.days <= 0) throw new Error("No working leave days in selected date range");
      if (hasOverlap) throw new Error("Selected dates overlap with an existing leave application");
      if (isBalanceExceeded) {
        throw new Error(
          `Insufficient balance. You have ${selectedBalance?.remaining ?? 0} days available.`
        );
      }
      if (isProofRequired && !attachmentFile) {
        throw new Error(
          `Supporting documentation is required for ${selectedType?.name} of ${selectedType?.document_proof_min_days || 2}+ days`
        );
      }

      setUploading(true);
      let attachmentUrl: string | null = null;

      // Handle attachment upload if present
      if (attachmentFile) {
        try {
          const fileExt = attachmentFile.name.split(".").pop();
          const filePath = `leaves/${employeeId}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("leave-attachments")
            .upload(filePath, attachmentFile);

          if (!uploadError) {
            attachmentUrl = filePath;
          }
        } catch {
          // If storage bucket isn't available, proceed without blocking
        }
      }

      // Call secure transactional RPC function
      const { data, error } = await supabase.rpc("apply_leave_transactional", {
        p_employee_id: employeeId,
        p_leave_type_id: leaveTypeId,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_days: dayCalculation.days,
        p_half_day: halfDay,
        p_half_day_period: halfDay ? halfDayPeriod : "full_day",
        p_reason: reason.trim() || null,
        p_attachment_url: attachmentUrl,
      });

      if (error) {
        // Fallback to direct insert if RPC not yet deployed
        const { error: insertError } = await supabase.from("leave_requests").insert({
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          from_date: fromDate,
          to_date: toDate,
          days: dayCalculation.days,
          half_day: halfDay,
          half_day_period: halfDay ? halfDayPeriod : "full_day",
          reason: reason.trim() || null,
          attachment_url: attachmentUrl,
          status: "pending",
          current_approval_level: "manager",
        });

        if (insertError) throw insertError;
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Leave application submitted successfully");
      onOpenChange(false);
      setReason("");
      setAttachmentFile(null);
      setHalfDay(false);
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["team-leaves"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit leave application");
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Apply for Leave</DialogTitle>
              <DialogDescription className="text-xs">
                Submit an organization leave application. Balances and working days are computed in real-time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          {/* Leave Type Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Leave Type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select leave category" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => {
                  const bal = leaveBalances.find((b) => b.leave_type_id === lt.id);
                  return (
                    <SelectItem key={lt.id} value={lt.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">
                          {lt.name} {lt.code ? `(${lt.code})` : ""}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                          {lt.is_paid ? (
                            <span>{bal?.remaining ?? lt.days_per_year}d remaining</span>
                          ) : (
                            <span>Unpaid (LWP)</span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedType && (
              <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{ borderColor: selectedType.color || undefined, color: selectedType.color || undefined }}
                >
                  {selectedType.is_paid ? "Paid Entitlement" : "Unpaid Leave"}
                </Badge>
                {selectedType.allow_carry_forward && (
                  <span>• Allows Carry-forward (max {selectedType.max_carry_forward_days}d)</span>
                )}
                {selectedType.allow_encashment && (
                  <span>• Encashable</span>
                )}
              </div>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (toDate < e.target.value) {
                    setToDate(e.target.value);
                  }
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
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* Half Day Option */}
          {(!selectedType || selectedType.allow_half_day) && (
            <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="halfDayToggle"
                    checked={halfDay}
                    onCheckedChange={(chk) => setHalfDay(Boolean(chk))}
                  />
                  <Label htmlFor="halfDayToggle" className="text-xs font-medium cursor-pointer">
                    Apply for Half-Day (0.5 day)
                  </Label>
                </div>
                {halfDay && (
                  <Badge variant="secondary" className="text-[10px]">
                    0.5 working day
                  </Badge>
                )}
              </div>

              {halfDay && (
                <div className="flex items-center gap-4 pt-1 pl-6">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      checked={halfDayPeriod === "first_half"}
                      onChange={() => setHalfDayPeriod("first_half")}
                      className="text-primary"
                    />
                    <span>First Half (Morning)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      checked={halfDayPeriod === "second_half"}
                      onChange={() => setHalfDayPeriod("second_half")}
                      className="text-primary"
                    />
                    <span>Second Half (Afternoon)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Working Days Summary Banner */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Net Working Days Deducted:
              </span>
              <span className="font-bold text-sm text-primary font-mono">
                {dayCalculation.days} {dayCalculation.days === 1 ? "day" : "days"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
              {dayCalculation.excludedWeeklyOffs > 0 && (
                <span>Excluded {dayCalculation.excludedWeeklyOffs} weekend days</span>
              )}
              {dayCalculation.excludedHolidays > 0 && (
                <span>• Excluded {dayCalculation.excludedHolidays} company holidays</span>
              )}
              {sandwichRuleEnabled && (
                <span className="text-amber-600 font-medium">• Sandwich rule active</span>
              )}
            </div>
          </div>

          {/* Overlap & Balance Warnings */}
          {hasOverlap && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Selected dates overlap with an existing pending or approved leave request.</span>
            </div>
          )}

          {isBalanceExceeded && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>
                Insufficient balance. You have {selectedBalance?.remaining ?? 0} days remaining for {selectedType?.name}.
              </span>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for Absence</Label>
            <Textarea
              placeholder="Provide context or explanation for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-xs resize-none"
              required
            />
          </div>

          {/* Supporting Document Proof */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Supporting Document {isProofRequired && <span className="text-rose-500">* Required</span>}
              </Label>
              <span className="text-[10px] text-muted-foreground">PDF, PNG, JPG (up to 5MB)</span>
            </div>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="text-xs h-9 cursor-pointer"
              required={isProofRequired}
            />
            {isProofRequired && (
              <p className="text-[10px] text-amber-600">
                Medical certificate or proof is required for {selectedType?.name} exceeding {selectedType?.document_proof_min_days} days.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                submitMutation.isPending ||
                uploading ||
                hasOverlap ||
                isBalanceExceeded ||
                dayCalculation.days <= 0 ||
                (isProofRequired && !attachmentFile)
              }
              className="text-xs h-9 gap-1.5 bg-primary text-white"
            >
              {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
