import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

export interface EditLeaveBalanceTarget {
  employeeId: string;
  employeeName?: string | undefined;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  total: number;
  used: number;
  carriedForward: number;
}

interface EditLeaveBalanceDialogProps {
  target: EditLeaveBalanceTarget | null;
  onOpenChange: (open: boolean) => void;
}

export function EditLeaveBalanceDialog({ target, onOpenChange }: EditLeaveBalanceDialogProps) {
  const queryClient = useQueryClient();
  const [totalInput, setTotalInput] = useState("0");
  const [usedInput, setUsedInput] = useState("0");
  const [carryInput, setCarryInput] = useState("0");

  useEffect(() => {
    if (!target) return;
    setTotalInput(String(target.total ?? 0));
    setUsedInput(String(target.used ?? 0));
    setCarryInput(String(target.carriedForward ?? 0));
  }, [target]);

  const parsedTotal = parseFloat(totalInput);
  const parsedUsed = parseFloat(usedInput);
  const parsedCarry = parseFloat(carryInput);
  const validTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
  const validUsed = Number.isFinite(parsedUsed) && parsedUsed >= 0 ? parsedUsed : 0;
  const remainingPreview = Math.round((validTotal - validUsed) * 10) / 10;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("No leave balance selected");
      if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
        throw new Error("Total days must be 0 or greater");
      }
      if (!Number.isFinite(parsedUsed) || parsedUsed < 0) {
        throw new Error("Used days must be 0 or greater");
      }
      if (!Number.isFinite(parsedCarry) || parsedCarry < 0) {
        throw new Error("Carried-forward days must be 0 or greater");
      }

      const { error } = await supabase.rpc("admin_adjust_leave_balance", {
        p_employee_id: target.employeeId,
        p_leave_type_id: target.leaveTypeId,
        p_year: target.year,
        p_total: parsedTotal,
        p_used: parsedUsed,
        p_carried_forward: parsedCarry,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave days updated");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-balances"] });
      queryClient.invalidateQueries({ queryKey: ["employee-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update leave days");
    },
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit2 className="h-4 w-4 text-primary" />
            Edit {target?.leaveTypeName || "Leave"} Days
          </DialogTitle>
          <DialogDescription className="text-xs">
            {target?.employeeName
              ? `Adjust leave entitlement and used days for ${target.employeeName} (${target.year}).`
              : `Adjust annual leave days for ${target?.year}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-bal-total" className="text-xs">
                Total Days
              </Label>
              <Input
                id="edit-bal-total"
                type="number"
                step="0.5"
                min="0"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-bal-used" className="text-xs">
                Used Days
              </Label>
              <Input
                id="edit-bal-used"
                type="number"
                step="0.5"
                min="0"
                value={usedInput}
                onChange={(e) => setUsedInput(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-bal-carry" className="text-xs">
                Carry Fwd
              </Label>
              <Input
                id="edit-bal-carry"
                type="number"
                step="0.5"
                min="0"
                value={carryInput}
                onChange={(e) => setCarryInput(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Remaining Balance:</span>
            <span
              className={`font-mono font-bold ${
                remainingPreview < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {remainingPreview} days
            </span>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saveMutation.isPending} className="h-8 text-xs gap-1.5">
              {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {saveMutation.isPending ? "Saving..." : "Save Leave Days"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
