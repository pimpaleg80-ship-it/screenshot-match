import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/attendance";

interface ShiftSwapItem {
  id: string;
  requester_employee_id: string;
  target_employee_id: string | null;
  requester_shift_id: string;
  requested_shift_id: string;
  swap_date: string;
  reason: string;
  target_accepted: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_notes: string | null;
  created_at: string;
  requester?: {
    id: string;
    full_name: string;
    employee_code: string;
    departments?: { name: string } | null;
  } | null;
  target?: {
    id: string;
    full_name: string;
    employee_code: string;
  } | null;
  current_shift?: {
    name: string;
    code: string | null;
    start_time: string;
    end_time: string;
  } | null;
  requested_shift?: {
    name: string;
    code: string | null;
    start_time: string;
    end_time: string;
  } | null;
}

export function ShiftSwapManager() {
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<"pending" | "all">("pending");
  const [selectedSwap, setSelectedSwap] = useState<ShiftSwapItem | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"approve" | "reject">("approve");
  const [adminNotes, setAdminNotes] = useState("");

  // Query shift swap requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["shift-swap-requests-admin", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("shift_swap_requests")
        .select(`
          id,
          requester_employee_id,
          target_employee_id,
          requester_shift_id,
          requested_shift_id,
          swap_date,
          reason,
          target_accepted,
          status,
          admin_notes,
          created_at,
          requester:employees!shift_swap_requests_requester_employee_id_fkey (id, full_name, employee_code, departments(name)),
          target:employees!shift_swap_requests_target_employee_id_fkey (id, full_name, employee_code),
          current_shift:shifts!shift_swap_requests_requester_shift_id_fkey (name, code, start_time, end_time),
          requested_shift:shifts!shift_swap_requests_requested_shift_id_fkey (name, code, start_time, end_time)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus === "pending") {
        q = q.eq("status", "pending");
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ShiftSwapItem[];
    },
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
      swap,
    }: {
      id: string;
      status: "approved" | "rejected";
      notes: string;
      swap: ShiftSwapItem;
    }) => {
      // 1. Update swap request status
      const { error: updErr } = await supabase
        .from("shift_swap_requests")
        .update({
          status,
          admin_notes: notes || `Shift swap ${status} by Manager`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updErr) throw updErr;

      // 2. If approved, update active employee shift or create assignment
      if (status === "approved") {
        await supabase
          .from("employees")
          .update({ shift_id: swap.requested_shift_id, updated_at: new Date().toISOString() })
          .eq("id", swap.requester_employee_id);

        if (swap.target_employee_id) {
          await supabase
            .from("employees")
            .update({ shift_id: swap.requester_shift_id, updated_at: new Date().toISOString() })
            .eq("id", swap.target_employee_id);
        }
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`Shift change request ${vars.status}`);
      setDecisionModalOpen(false);
      setSelectedSwap(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["shift-swap-requests-admin"] });
      queryClient.invalidateQueries({ queryKey: ["shifts-list-all"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process shift request");
    },
  });

  function handleOpenDecision(swap: ShiftSwapItem, type: "approve" | "reject") {
    setSelectedSwap(swap);
    setDecisionType(type);
    setAdminNotes("");
    setDecisionModalOpen(true);
  }

  function handleConfirm() {
    if (!selectedSwap) return;
    decisionMutation.mutate({
      id: selectedSwap.id,
      status: decisionType === "approve" ? "approved" : "rejected",
      notes: adminNotes,
      swap: selectedSwap,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" /> Shift Swap & Change Approvals
            </CardTitle>
            <CardDescription className="text-xs">
              Review requests from team members seeking shift swaps with peers or schedule transfers.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant={filterStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("pending")}
              className="h-8 text-xs"
            >
              Pending ({requests.filter((r) => r.status === "pending").length})
            </Button>
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
              className="h-8 text-xs"
            >
              All Requests
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/40 mb-2" />
            <p className="font-semibold text-foreground text-sm">No Pending Shift Swap Requests</p>
            <p className="mt-1">All employee shift transfer requests have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                  <th className="py-2.5 px-3">Requester</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Current Shift</th>
                  <th className="py-2.5 px-3">Requested Shift / Peer</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-medium">
                      <p className="font-bold text-foreground">{r.requester?.full_name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {r.requester?.employee_code} • {r.requester?.departments?.name || "General"}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.swap_date)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px]">
                        {r.current_shift?.name || "General"} ({r.current_shift?.start_time?.slice(0, 5)})
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <Badge className="bg-primary/10 text-primary text-[10px] border-primary/20">
                          {r.requested_shift?.name || "Shift"} ({r.requested_shift?.start_time?.slice(0, 5)})
                        </Badge>
                        {r.target && (
                          <p className="text-[10px] text-muted-foreground">
                            Swap with: {r.target.full_name} ({r.target.employee_code})
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs text-muted-foreground">
                      <p className="line-clamp-2">{r.reason}</p>
                      {r.admin_notes && (
                        <p className="text-[11px] text-primary font-medium mt-0.5">
                          Admin: {r.admin_notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          r.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                            : r.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 border-rose-300"
                              : "bg-amber-500/10 text-amber-600 border-amber-300"
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {r.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleOpenDecision(r, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => handleOpenDecision(r, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Decision Modal */}
      {selectedSwap && (
        <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-base">
                {decisionType === "approve" ? "Approve Shift Change" : "Reject Shift Change"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {decisionType === "approve"
                  ? `Confirm shift assignment change for ${selectedSwap.requester?.full_name} to ${selectedSwap.requested_shift?.name}.`
                  : `Reject shift change request for ${selectedSwap.requester?.full_name}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 font-mono text-xs">
                <div>Date: {formatDate(selectedSwap.swap_date)}</div>
                <div>Requester: {selectedSwap.requester?.full_name}</div>
                <div>From: {selectedSwap.current_shift?.name}</div>
                <div>To: {selectedSwap.requested_shift?.name}</div>
                <div className="pt-1 text-muted-foreground font-sans">Reason: {selectedSwap.reason}</div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Management Notes (Optional)</Label>
                <Textarea
                  placeholder="Notes regarding this shift approval or rejection..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDecisionModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={decisionMutation.isPending}
                className={`text-xs h-8 ${
                  decisionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {decisionMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {decisionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
