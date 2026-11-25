import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, PlusCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toDateKey } from "@/lib/attendance";

interface AttendanceCorrectionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  defaultDate?: string | undefined;
  attendanceId?: string | null | undefined;
}

export function AttendanceCorrectionRequestDialog({
  open,
  onOpenChange,
  employeeId,
  defaultDate,
  attendanceId,
}: AttendanceCorrectionRequestDialogProps) {
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [date, setDate] = useState(defaultDate || todayKey);
  const [checkInTime, setCheckInTime] = useState("09:00");
  const [checkOutTime, setCheckOutTime] = useState("18:00");
  const [reason, setReason] = useState("");

  const submitCorrectionMutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Please select the target date");
      if (!checkInTime && !checkOutTime) {
        throw new Error("Please provide at least a requested check-in or check-out time");
      }
      if (!reason.trim()) {
        throw new Error("Please provide a reason for the attendance correction");
      }

      const { error } = await supabase.from("attendance_corrections").insert({
        employee_id: employeeId,
        attendance_id: attendanceId || null,
        date,
        requested_check_in: checkInTime ? `${checkInTime}:00` : null,
        requested_check_out: checkOutTime ? `${checkOutTime}:00` : null,
        reason: reason.trim(),
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance correction request submitted to HR");
      onOpenChange(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["my-attendance-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-correction-requests"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit correction request");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Request Attendance Correction
          </DialogTitle>
          <DialogDescription className="text-xs">
            Submit missed punch adjustments or corrections for review and approval by HR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Target Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-xs"
              max={todayKey}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Requested Check-In</Label>
              <Input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Requested Check-Out</Label>
              <Input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason / Justification</Label>
            <Textarea
              placeholder="e.g. Forgot to punch out after late deployment / Onsite client meeting / Scanner terminal glitch..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => submitCorrectionMutation.mutate()}
            disabled={submitCorrectionMutation.isPending || !reason.trim()}
            className="gap-1.5 text-xs h-8"
          >
            {submitCorrectionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
