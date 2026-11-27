import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MONTH_NAMES } from "@/lib/payroll";
import { Calculator } from "lucide-react";

interface ProcessPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  userId: string;
  onSuccessRun?: (runId: string) => void;
}

export function ProcessPayrollDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  onSuccessRun,
}: ProcessPayrollDialogProps) {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const processMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("calculate_monthly_payroll_run", {
        _organization_id: organizationId,
        _year: selectedYear,
        _month: selectedMonth,
        _user_id: userId,
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        throw new Error(res.error || "Payroll calculation failed.");
      }
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-payslips"] });
      toast.success(
        `Payroll calculated for ${data.total_employees} employees (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}).`
      );
      onOpenChange(false);
      if (onSuccessRun && data.payroll_run_id) {
        onSuccessRun(data.payroll_run_id);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process payroll.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Process Monthly Payroll
          </DialogTitle>
          <DialogDescription className="text-xs">
            Calculates gross salaries, Indian statutory deductions (EPF, ESI, PT, TDS), attendance-based LOP, and overtime for all active employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Month</Label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(Number(val))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={name} value={String(idx + 1)} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Year</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <SelectItem key={yr} value={String(yr)} className="text-xs">
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1 text-muted-foreground">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-primary" /> Calculation Engine Rules:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>Applies individual salary structures and statutory limits.</li>
              <li>Pulls biometric check-in & approved leave records for LOP.</li>
              <li>Generates reviewable payslips in draft status for HR approval.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="gap-1.5"
          >
            {processMutation.isPending ? "Computing..." : "Run Payroll Calculation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
