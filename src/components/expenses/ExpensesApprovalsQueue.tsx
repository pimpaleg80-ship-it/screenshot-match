import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  AlertCircle,
  XCircle,
  Eye,
  Check,
  X,
  Loader2,
  Shield,
  User,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExpenseClaim,
  STATUS_CONFIG,
  formatCurrency,
  getReceiptSignedUrl,
} from "@/lib/expenses";
import { formatDate } from "@/lib/attendance";
import { ExpenseDetailModal } from "./ExpenseDetailModal";

export function ExpensesApprovalsQueue() {
  const session = useSession();
  const queryClient = useQueryClient();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  const [activeTab, setActiveTab] = useState<"manager" | "finance" | "payout">("manager");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Fetch all pending / approved claims
  const { data: claims = [], isLoading, refetch } = useQuery({
    queryKey: ["expense-claims-queue"],
    queryFn: async () => {
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ExpenseClaim[];
    },
  });

  const managerQueue = claims.filter((c) => c.status === "pending");
  const financeQueue = claims.filter((c) => c.status === "pending_finance");
  const payoutQueue = claims.filter((c) => c.status === "approved");

  // Inline Quick Approve Mutation
  const quickApproveMutation = useMutation({
    mutationFn: async ({ claimId, level }: { claimId: string; level: "manager" | "finance" }) => {
      const { data, error } = await supabase.rpc("approve_expense_claim", {
        p_claim_id: claimId,
        p_level: level,
        p_notes: `Quick approved via ${level === "manager" ? "Manager" : "Finance"} dashboard`,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.level === "manager"
          ? "Claim approved and forwarded to Finance queue"
          : "Claim verified and queued for reimbursement disbursement"
      );
      queryClient.invalidateQueries({ queryKey: ["expense-claims-queue"] });
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve claim");
    },
  });

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "manager" | "finance" | "payout")}
        className="space-y-4"
      >
        <TabsList className="bg-card border p-1 rounded-lg flex flex-wrap h-auto gap-1">
          <TabsTrigger value="manager" className="gap-2 text-xs sm:text-sm">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>1. Manager Review ({managerQueue.length})</span>
          </TabsTrigger>

          <TabsTrigger value="finance" className="gap-2 text-xs sm:text-sm">
            <Shield className="w-4 h-4 text-blue-500" />
            <span>2. Finance / HR Sign-Off ({financeQueue.length})</span>
          </TabsTrigger>

          <TabsTrigger value="payout" className="gap-2 text-xs sm:text-sm">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <span>3. Ready for Reimbursement ({payoutQueue.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MANAGER REVIEW */}
        <TabsContent value="manager" className="m-0">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Manager Approval Queue</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                  {managerQueue.length} Pending Initial Review
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                First-stage approval required by reporting managers before financial verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <QueueTable
                claims={managerQueue}
                isLoading={isLoading}
                onSelect={(id) => setSelectedClaimId(id)}
                onApprove={(id) => quickApproveMutation.mutate({ claimId: id, level: "manager" })}
                isApproving={quickApproveMutation.isPending}
                actionLabel="Manager Approve"
                canApprove={isManager}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FINANCE REVIEW */}
        <TabsContent value="finance" className="m-0">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Finance & HR Verification Queue</span>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                  {financeQueue.length} Awaiting Verification
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Second-stage financial policy and receipt verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <QueueTable
                claims={financeQueue}
                isLoading={isLoading}
                onSelect={(id) => setSelectedClaimId(id)}
                onApprove={(id) => quickApproveMutation.mutate({ claimId: id, level: "finance" })}
                isApproving={quickApproveMutation.isPending}
                actionLabel="Finance Approve"
                canApprove={isHRorAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: READY FOR REIMBURSEMENT PAYOUT */}
        <TabsContent value="payout" className="m-0">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Disbursement Payout Queue</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  {payoutQueue.length} Approved & Ready
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Fully verified claims ready for bank transfer disbursement or payroll credit.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <QueueTable
                claims={payoutQueue}
                isLoading={isLoading}
                onSelect={(id) => setSelectedClaimId(id)}
                onApprove={(id) => setSelectedClaimId(id)}
                isApproving={false}
                actionLabel="Disburse Payment"
                canApprove={isHRorAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Claim Detail Modal */}
      <ExpenseDetailModal
        claimId={selectedClaimId}
        open={!!selectedClaimId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedClaimId(null);
        }}
        onUpdated={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
        }}
      />
    </div>
  );
}

interface QueueTableProps {
  claims: ExpenseClaim[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  isApproving: boolean;
  actionLabel: string;
  canApprove: boolean;
}

function QueueTable({
  claims,
  isLoading,
  onSelect,
  onApprove,
  isApproving,
  actionLabel,
  canApprove,
}: QueueTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Loading approval queue...</span>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground space-y-1.5">
        <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto" />
        <p className="text-xs font-semibold text-foreground">Queue is clear</p>
        <p className="text-[11px] text-muted-foreground">
          No expense claims currently pending action in this stage.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
          <tr>
            <th className="p-3 pl-4">Claim</th>
            <th className="p-3">Category</th>
            <th className="p-3">Employee</th>
            <th className="p-3">Expense Date</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Receipt</th>
            <th className="p-3 text-right pr-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {claims.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <td className="p-3 pl-4 font-semibold text-foreground max-w-[220px] truncate">
                {c.title}
              </td>
              <td className="p-3">
                <Badge variant="outline" className="text-[10px] bg-muted">
                  {c.category}
                </Badge>
              </td>
              <td className="p-3">
                <div className="font-medium text-foreground">{c.employee?.full_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {c.employee?.department?.name || "General"}
                </div>
              </td>
              <td className="p-3 text-muted-foreground whitespace-nowrap">
                {formatDate(c.expense_date)}
              </td>
              <td className="p-3 font-mono font-bold text-foreground">
                {formatCurrency(Number(c.amount))}
              </td>
              <td className="p-3">
                {c.receipt_url || c.receipt_storage_path ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Attached</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px] italic">No receipt</span>
                )}
              </td>
              <td className="p-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => onSelect(c.id)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Details</span>
                  </Button>

                  {canApprove && (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-none"
                      onClick={() => onApprove(c.id)}
                      disabled={isApproving}
                    >
                      {isApproving ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      <span>{actionLabel}</span>
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
