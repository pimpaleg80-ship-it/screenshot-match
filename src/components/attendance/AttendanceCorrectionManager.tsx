import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Loader2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { formatDate } from "@/lib/attendance";

interface AttendanceCorrectionManagerProps {
  organizationId?: string | null;
}

interface CorrectionItem {
  id: string;
  attendance_id: string | null;
  employee_id: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
  decided_at: string | null;
  employees?: {
    id: string;
    full_name: string;
    employee_code: string;
    departments?: { name: string } | null;
    designation: string | null;
  } | null;
  attendance?: {
    check_in: string | null;
    check_out: string | null;
    status: string;
  } | null;
}

export function AttendanceCorrectionManager({ organizationId }: AttendanceCorrectionManagerProps) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionItem | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [adminNotes, setAdminNotes] = useState("");

  // Query correction requests
  const { data: corrections = [], isLoading } = useQuery({
    queryKey: ["attendance-correction-requests", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("attendance_corrections")
        .select(`
          id,
          attendance_id,
          employee_id,
          date,
          requested_check_in,
          requested_check_out,
          reason,
          status,
          admin_notes,
          created_at,
          decided_at,
          employees (id, full_name, employee_code, designation, departments(name)),
          attendance (check_in, check_out, status)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter === "pending") {
        q = q.eq("status", "pending");
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CorrectionItem[];
    },
  });

  // Approve correction mutation (calls database RPC)
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data, error } = await supabase.rpc("approve_attendance_correction", {
        p_correction_id: id,
        p_admin_notes: notes || "Approved by HR",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Attendance correction approved and record updated");
      setDecisionModalOpen(false);
      setSelectedCorrection(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["attendance-correction-requests"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve correction");
    },
  });

  // Reject correction mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("attendance_corrections")
        .update({
          status: "rejected",
          admin_notes: notes || "Rejected by HR",
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance correction rejected");
      setDecisionModalOpen(false);
      setSelectedCorrection(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["attendance-correction-requests"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject correction");
    },
  });

  function handleOpenDecision(correction: CorrectionItem, type: "approve" | "reject") {
    setSelectedCorrection(correction);
    setActionType(type);
    setAdminNotes("");
    setDecisionModalOpen(true);
  }

  function handleConfirmDecision() {
    if (!selectedCorrection) return;
    if (actionType === "approve") {
      approveMutation.mutate({ id: selectedCorrection.id, notes: adminNotes });
    } else {
      rejectMutation.mutate({ id: selectedCorrection.id, notes: adminNotes });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Attendance Correction Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Review and approve employee requests to adjust missing, incomplete, or erroneous punch times.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className="h-8 text-xs"
            >
              Pending ({corrections.filter((c) => c.status === "pending").length})
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
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
        ) : corrections.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/40 mb-2" />
            <p className="font-semibold text-foreground text-sm">No Pending Correction Requests</p>
            <p className="mt-1">All employee attendance adjustments have been reviewed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Original Punch</th>
                  <th className="py-2.5 px-3">Requested Punch</th>
                  <th className="py-2.5 px-3">Reason / Justification</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {corrections.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-medium">
                      <p className="font-bold text-foreground">{c.employees?.full_name || "Employee"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {c.employees?.employee_code} • {c.employees?.departments?.name || "General"}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(c.date)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      {c.attendance?.check_in ? (
                        <span>
                          In: {new Date(c.attendance.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-amber-600">No In</span>
                      )}
                      {" — "}
                      {c.attendance?.check_out ? (
                        <span>
                          Out: {new Date(c.attendance.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-amber-600">No Out</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-primary">
                      In: {c.requested_check_in ? c.requested_check_in.slice(0, 5) : "—"}
                      {" | "}
                      Out: {c.requested_check_out ? c.requested_check_out.slice(0, 5) : "—"}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs text-muted-foreground">
                      <p className="line-clamp-2">{c.reason}</p>
                      {c.admin_notes && (
                        <p className="text-[11px] text-primary font-medium mt-0.5">
                          Admin note: {c.admin_notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          c.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                            : c.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 border-rose-300"
                              : "bg-amber-500/10 text-amber-600 border-amber-300"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {c.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleOpenDecision(c, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => handleOpenDecision(c, "reject")}
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
      {selectedCorrection && (
        <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-base">
                {actionType === "approve" ? "Approve Attendance Correction" : "Reject Attendance Correction"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {actionType === "approve"
                  ? `Confirm approval for ${selectedCorrection.employees?.full_name} on ${formatDate(selectedCorrection.date)}. The attendance log will be updated and hours recalculated.`
                  : `Reject correction request for ${selectedCorrection.employees?.full_name}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 font-mono text-xs">
                <div>Requested Date: {formatDate(selectedCorrection.date)}</div>
                <div>Requested Check-In: {selectedCorrection.requested_check_in || "None"}</div>
                <div>Requested Check-Out: {selectedCorrection.requested_check_out || "None"}</div>
                <div className="pt-1 text-muted-foreground font-sans">
                  Reason: {selectedCorrection.reason}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">HR Review Comment (Optional)</Label>
                <Textarea
                  placeholder="Note regarding approval or rejection reason..."
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
                onClick={handleConfirmDecision}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`text-xs h-8 ${
                  actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {(approveMutation.isPending || rejectMutation.isPending) && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
