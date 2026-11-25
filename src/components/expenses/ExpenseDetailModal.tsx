import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Download,
  AlertCircle,
  Loader2,
  FileText,
  User,
  Shield,
  CreditCard,
  Building,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  ExpenseClaim,
  ExpenseHistory,
  STATUS_CONFIG,
  formatCurrency,
  getReceiptSignedUrl,
  formatExpenseFileSize,
} from "@/lib/expenses";
import { formatDate } from "@/lib/attendance";

interface ExpenseDetailModalProps {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function ExpenseDetailModal({
  claimId,
  open,
  onOpenChange,
  onUpdated,
}: ExpenseDetailModalProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Reimbursement modal
  const [reimburseModalOpen, setReimburseModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [reimbursementRef, setReimbursementRef] = useState("");
  const [reimbursementNotes, setReimbursementNotes] = useState("");

  // Fetch Claim
  const { data: claim, isLoading: claimLoading } = useQuery({
    queryKey: ["expense-claim-detail", claimId],
    queryFn: async () => {
      if (!claimId) return null;
      const { data, error } = await supabase
        .from("expense_claims")
        .select(`
          *,
          employee:employees!expense_claims_employee_id_fkey(
            id,
            full_name,
            email,
            department:departments(id, name)
          )
        `)
        .eq("id", claimId)
        .single();

      if (error) throw error;
      return data as unknown as ExpenseClaim;
    },
    enabled: open && !!claimId,
  });

  // Fetch History Audit Logs
  const { data: historyLogs = [], isLoading: historyLoading } = useQuery({
    queryKey: ["expense-claim-history", claimId],
    queryFn: async () => {
      if (!claimId) return [];
      const { data, error } = await supabase
        .from("expense_history")
        .select("*")
        .eq("expense_id", claimId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ExpenseHistory[];
    },
    enabled: open && !!claimId && activeTab === "history",
  });

  // Transactional Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ level, notes }: { level: "manager" | "finance"; notes?: string }) => {
      if (!claimId) return;
      const { data, error } = await supabase.rpc("approve_expense_claim", {
        p_claim_id: claimId,
        p_level: level,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.level === "manager"
          ? "Manager approval recorded and claim routed to Finance"
          : "Finance approval recorded. Ready for reimbursement."
      );
      queryClient.invalidateQueries({ queryKey: ["expense-claim-detail", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claim-history", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["my-expense-claims"] });
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve expense claim");
    },
  });

  // Transactional Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!claimId || !rejectionReason.trim()) throw new Error("Please enter a rejection reason");
      const { data, error } = await supabase.rpc("reject_expense_claim", {
        p_claim_id: claimId,
        p_reason: rejectionReason.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Expense claim has been rejected");
      setRejectModalOpen(false);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["expense-claim-detail", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claim-history", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["my-expense-claims"] });
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject claim");
    },
  });

  // Transactional Mark Reimbursed Mutation
  const reimburseMutation = useMutation({
    mutationFn: async () => {
      if (!claimId) return;
      const { data, error } = await supabase.rpc("mark_expense_reimbursed", {
        p_claim_id: claimId,
        p_reference: reimbursementRef.trim() || null,
        p_payment_method: paymentMethod,
        p_notes: reimbursementNotes.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Reimbursement payment recorded successfully");
      setReimburseModalOpen(false);
      setReimbursementRef("");
      setReimbursementNotes("");
      queryClient.invalidateQueries({ queryKey: ["expense-claim-detail", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claim-history", claimId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["my-expense-claims"] });
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disburse reimbursement");
    },
  });

  const handleDownloadReceipt = async (path: string) => {
    try {
      const signedUrl = await getReceiptSignedUrl(path);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error("Unable to open receipt: " + e.message);
    }
  };

  const statusConf = claim ? STATUS_CONFIG[claim.status] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {claimLoading || !claim ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading expense claim details...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-5 border-b bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                      {claim.category}
                    </span>
                    <Badge variant="outline" className={statusConf?.badgeClass}>
                      {statusConf?.label}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Expense Date: <strong>{formatDate(claim.expense_date)}</strong>
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground leading-snug">{claim.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted by:{" "}
                      <strong className="text-foreground">{claim.employee?.full_name}</strong> (
                      {claim.employee?.department?.name || "General"})
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-primary">
                      {formatCurrency(Number(claim.amount))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Stage Approval Workflow Stepper */}
              <div className="px-5 py-3 border-b bg-card">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Approval Lifecycle
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {/* Step 1: Employee */}
                  <div className="p-2 rounded border bg-emerald-500/10 border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400">Submitted</div>
                    <div className="text-[10px] text-muted-foreground">by Employee</div>
                  </div>

                  {/* Step 2: Manager */}
                  <div
                    className={`p-2 rounded border ${
                      claim.status === "rejected"
                        ? "bg-rose-500/10 border-rose-200"
                        : claim.status === "pending"
                        ? "bg-amber-500/10 border-amber-300 font-bold animate-pulse"
                        : "bg-emerald-500/10 border-emerald-200"
                    }`}
                  >
                    {claim.status === "rejected" ? (
                      <XCircle className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                    ) : claim.status === "pending" ? (
                      <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    )}
                    <div className="font-semibold">Manager Review</div>
                    <div className="text-[10px] text-muted-foreground">
                      {claim.manager_approved_at ? "Approved" : claim.status === "pending" ? "Pending" : "—"}
                    </div>
                  </div>

                  {/* Step 3: Finance */}
                  <div
                    className={`p-2 rounded border ${
                      claim.status === "pending_finance"
                        ? "bg-blue-500/10 border-blue-300 font-bold animate-pulse"
                        : claim.status === "approved" || claim.status === "reimbursed"
                        ? "bg-emerald-500/10 border-emerald-200"
                        : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    {claim.status === "approved" || claim.status === "reimbursed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    ) : claim.status === "pending_finance" ? (
                      <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    ) : (
                      <Shield className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                    )}
                    <div className="font-semibold">Finance Sign-Off</div>
                    <div className="text-[10px] text-muted-foreground">
                      {claim.finance_approved_at ? "Verified" : claim.status === "pending_finance" ? "In Review" : "—"}
                    </div>
                  </div>

                  {/* Step 4: Reimbursement */}
                  <div
                    className={`p-2 rounded border ${
                      claim.status === "reimbursed"
                        ? "bg-emerald-500/10 border-emerald-200"
                        : claim.status === "approved"
                        ? "bg-indigo-500/10 border-indigo-300 font-bold animate-pulse"
                        : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >
                    {claim.status === "reimbursed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                    )}
                    <div className="font-semibold">Disbursed</div>
                    <div className="text-[10px] text-muted-foreground">
                      {claim.reimbursed_at ? "Paid" : claim.status === "approved" ? "Queued" : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: Tabs (Details vs Audit History) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "details" | "history")}>
                  <TabsList className="grid grid-cols-2 w-full mb-4">
                    <TabsTrigger value="details" className="text-xs">
                      Claim Details & Receipt
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">
                      Approval Audit Trail
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 m-0">
                    {/* Business Purpose / Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Business Purpose & Description
                      </Label>
                      <div className="p-3 bg-muted/30 rounded-lg border text-xs text-foreground whitespace-pre-line leading-relaxed">
                        {claim.notes || "No additional description provided."}
                      </div>
                    </div>

                    {/* Receipt Viewer Card */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Receipt / Bill Attachment
                      </Label>
                      {claim.receipt_url || claim.receipt_storage_path ? (
                        <div className="flex items-center justify-between p-3 bg-card rounded-lg border text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <Receipt className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium truncate">
                              {claim.receipt_name || "Official Receipt Proof"}
                            </span>
                            {claim.receipt_size && (
                              <span className="text-muted-foreground text-[11px]">
                                ({formatExpenseFileSize(claim.receipt_size)})
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() =>
                              handleDownloadReceipt(
                                (claim.receipt_storage_path || claim.receipt_url)!
                              )
                            }
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View / Download</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed text-center text-xs text-muted-foreground italic">
                          No receipt document attached to this claim.
                        </div>
                      )}
                    </div>

                    {/* Approver Notes Banners */}
                    {claim.manager_notes && (
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-500/10 text-xs space-y-1">
                        <div className="font-semibold text-amber-800 dark:text-amber-300">
                          Manager Review Notes:
                        </div>
                        <p className="text-amber-900 dark:text-amber-200">{claim.manager_notes}</p>
                      </div>
                    )}

                    {claim.finance_notes && (
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-500/10 text-xs space-y-1">
                        <div className="font-semibold text-blue-800 dark:text-blue-300">
                          Finance Verification Notes:
                        </div>
                        <p className="text-blue-900 dark:text-blue-200">{claim.finance_notes}</p>
                      </div>
                    )}

                    {claim.reimbursement_reference && (
                      <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-500/10 text-xs space-y-1">
                        <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4" />
                          <span>Disbursement Settlement:</span>
                        </div>
                        <p className="text-emerald-900 dark:text-emerald-200">
                          Disbursed via <strong>{claim.payment_method || "Bank Transfer"}</strong>.
                          Reference: <span className="font-mono">{claim.reimbursement_reference}</span> on{" "}
                          {claim.reimbursed_at ? formatDate(claim.reimbursed_at) : "Settled"}.
                        </p>
                      </div>
                    )}

                    {claim.rejection_reason && (
                      <div className="p-3 rounded-lg border border-rose-200 bg-rose-500/10 text-xs space-y-1">
                        <div className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          <span>Declined Reason:</span>
                        </div>
                        <p className="text-rose-900 dark:text-rose-200">{claim.rejection_reason}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="m-0 space-y-3">
                    {historyLoading ? (
                      <div className="flex items-center justify-center p-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : historyLogs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground italic">
                        No audit history recorded.
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        {historyLogs.map((log) => (
                          <div key={log.id} className="relative space-y-1">
                            <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-primary/20 border-2 border-primary" />
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold capitalize text-foreground">
                                {log.action.replace("_", " ")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(log.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
                                {log.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>

                {/* Manager Review Controls */}
                {isManager && claim.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                      onClick={() => setRejectModalOpen(true)}
                    >
                      Reject Claim
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
                      onClick={() =>
                        approveMutation.mutate({
                          level: "manager",
                          notes: "Approved by manager and routed to Finance",
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Manager Approve</span>
                    </Button>
                  </div>
                )}

                {/* Finance Review Controls */}
                {isHRorAdmin && claim.status === "pending_finance" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                      onClick={() => setRejectModalOpen(true)}
                    >
                      Reject Claim
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                      onClick={() =>
                        approveMutation.mutate({
                          level: "finance",
                          notes: "Approved by Finance/HR. Ready for reimbursement.",
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Finance Approve</span>
                    </Button>
                  </div>
                )}

                {/* Reimbursement Disbursement Controls */}
                {isHRorAdmin && claim.status === "approved" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    onClick={() => setReimburseModalOpen(true)}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Mark Reimbursed</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* REJECT CLAIM MODAL */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Decline Expense Claim</span>
            </DialogTitle>
            <DialogDescription>
              State the reason for rejecting this claim. The employee will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="rej-reason" className="text-xs font-semibold">
              Rejection Reason <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="rej-reason"
              rows={3}
              placeholder="e.g., Ineligible travel expense, or original tax invoice missing GST details..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              <span>Confirm Rejection</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MARK REIMBURSED MODAL */}
      <Dialog open={reimburseModalOpen} onOpenChange={setReimburseModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Disburse Reimbursement</span>
            </DialogTitle>
            <DialogDescription>
              Record the bank transfer, UTR number, or settlement details for this claim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</SelectItem>
                  <SelectItem value="UPI">UPI / Instant Pay</SelectItem>
                  <SelectItem value="Company Payroll Credit">Company Payroll Credit</SelectItem>
                  <SelectItem value="Corporate Card Reimbursement">Corporate Card Reimbursement</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref" className="text-xs font-semibold">
                Transaction Reference / UTR Number
              </Label>
              <Input
                id="pay-ref"
                placeholder="e.g., UTR-9823482394 or BATCH-PAYROLL-NOV26"
                value={reimbursementRef}
                onChange={(e) => setReimbursementRef(e.target.value)}
                className="text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-notes" className="text-xs font-semibold">
                Payment Settlement Notes
              </Label>
              <Textarea
                id="pay-notes"
                rows={2}
                placeholder="Optional payment notes or accounting ledger reference..."
                value={reimbursementNotes}
                onChange={(e) => setReimbursementNotes(e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReimburseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={reimburseMutation.isPending}
              onClick={() => reimburseMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {reimburseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              <span>Confirm Reimbursement</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
