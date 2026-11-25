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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EXIT_REASON_CATEGORIES } from "@/lib/offboarding";
import { LogOut, Calendar } from "lucide-react";

interface ResignationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName?: string | null | undefined;
  defaultNoticeDays?: number | undefined;
}

export function ResignationModal({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  defaultNoticeDays = 30,
}: ResignationModalProps) {
  const queryClient = useQueryClient();

  // Default requested LWD = today + notice period
  const defaultLwdDate = new Date();
  defaultLwdDate.setDate(defaultLwdDate.getDate() + defaultNoticeDays);
  const defaultLwdStr = defaultLwdDate.toISOString().split("T")[0] || "";

  const [requestedLwd, setRequestedLwd] = useState<string>(defaultLwdStr);
  const [reasonCategory, setReasonCategory] = useState<string>(EXIT_REASON_CATEGORIES[0] || "Better Opportunity");
  const [reason, setReason] = useState<string>("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!requestedLwd) throw new Error("Requested last working day is required.");
      if (!reason.trim()) throw new Error("Please specify your reason for resignation.");

      const { data, error } = await supabase.rpc("submit_employee_resignation", {
        _employee_id: employeeId,
        _requested_lwd: requestedLwd,
        _reason_category: reasonCategory,
        _employee_reason: reason,
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        throw new Error(res.error || "Failed to submit resignation.");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-exits"] });
      queryClient.invalidateQueries({ queryKey: ["my-exit-record"] });
      toast.success("Resignation submitted successfully. Department clearances initiated.");
      onOpenChange(false);
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit resignation.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4 text-rose-500" />
            Submit Formal Resignation
          </DialogTitle>
          <DialogDescription className="text-xs">
            Initiate separation process for {employeeName || "Employee"}. Standard policy notice period is{" "}
            <span className="font-semibold text-foreground">{defaultNoticeDays} days</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Primary Reason</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXIT_REASON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Requested Last Working Day</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Notice: {defaultNoticeDays} days
              </span>
            </Label>
            <Input
              type="date"
              value={requestedLwd}
              onChange={(e) => setRequestedLwd(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Detailed Comments & Transition Notes</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details regarding your decision and any special transition handover notes..."
              rows={4}
              className="text-xs resize-none"
            />
          </div>

          <div className="p-3 bg-muted/30 rounded-lg border text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-[11px]">Separation Workflow:</p>
            <ul className="list-disc list-inside text-[11px] space-y-0.5">
              <li>Reporting Manager & HR review and approval.</li>
              <li>Knowledge transfer and company asset handover checklist.</li>
              <li>IT, Finance, and HR clearance sign-offs.</li>
              <li>Full & Final settlement and issuance of Relieving & Experience certificates.</li>
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
            variant="destructive"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Resignation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
