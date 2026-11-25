import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Clock, Users, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toDateKey } from "@/lib/attendance";

interface ShiftSwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  currentShiftId?: string | null | undefined;
}

export function ShiftSwapRequestDialog({
  open,
  onOpenChange,
  employeeId,
  currentShiftId,
}: ShiftSwapRequestDialogProps) {
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [swapDate, setSwapDate] = useState(todayKey);
  const [requestedShiftId, setRequestedShiftId] = useState("");
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("none");
  const [reason, setReason] = useState("");

  // Query shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-swap-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, name, code, start_time, end_time, color")
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Query peers (other employees)
  const { data: peers = [] } = useQuery({
    queryKey: ["peers-swap-options", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, departments(name)")
        .neq("id", employeeId)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const submitSwapMutation = useMutation({
    mutationFn: async () => {
      if (!currentShiftId) {
        throw new Error("You do not have an active shift assigned to swap from.");
      }
      if (!requestedShiftId) {
        throw new Error("Please select the shift you want to take.");
      }
      if (!swapDate) {
        throw new Error("Please choose the target date.");
      }
      if (!reason.trim()) {
        throw new Error("Please state the reason for this shift swap request.");
      }

      const { error } = await supabase.from("shift_swap_requests").insert({
        requester_employee_id: employeeId,
        target_employee_id: targetEmployeeId === "none" ? null : targetEmployeeId,
        requester_shift_id: currentShiftId,
        requested_shift_id: requestedShiftId,
        swap_date: swapDate,
        reason: reason.trim(),
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift swap request submitted for approval");
      onOpenChange(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["my-shift-swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["shift-swap-requests-admin"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit swap request");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" /> Request Shift Swap / Change
          </DialogTitle>
          <DialogDescription className="text-xs">
            Submit a request to swap your shift with a team member or request a schedule transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Target Date</Label>
            <Input
              type="date"
              value={swapDate}
              onChange={(e) => setSwapDate(e.target.value)}
              className="h-8 text-xs"
              min={todayKey}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Requested New Shift</Label>
            <Select value={requestedShiftId} onValueChange={setRequestedShiftId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select shift to take" />
              </SelectTrigger>
              <SelectContent>
                {shifts
                  .filter((s) => s.id !== currentShiftId)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code}) — {s.start_time.slice(0, 5)} to {s.end_time.slice(0, 5)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Swap Colleague (Optional)</Label>
            <Select value={targetEmployeeId} onValueChange={setTargetEmployeeId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose peer to swap with" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific peer (General shift transfer)</SelectItem>
                {peers.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} ({p.employee_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason for Swap</Label>
            <Textarea
              placeholder="Explain why you are requesting this shift swap..."
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
            onClick={() => submitSwapMutation.mutate()}
            disabled={submitSwapMutation.isPending || !requestedShiftId || !reason.trim()}
            className="gap-1.5 text-xs h-8"
          >
            {submitSwapMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
