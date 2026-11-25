import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  FileText,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/attendance";
import {
  ExpenseClaim,
  STATUS_CONFIG,
  formatCurrency,
} from "@/lib/expenses";
import { CreateExpenseDialog } from "@/components/expenses/CreateExpenseDialog";
import { ExpenseDetailModal } from "@/components/expenses/ExpenseDetailModal";

interface SelfServiceExpensesProps {
  employeeId: string;
}

export function SelfServiceExpenses({ employeeId }: SelfServiceExpensesProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Query my expense claims
  const {
    data: claims = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["my-expense-claims", employeeId],
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
        .eq("employee_id", employeeId)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ExpenseClaim[];
    },
    enabled: !!employeeId,
  });

  // Calculate metrics
  const stats = useMemo(() => {
    let totalClaimed = 0;
    let pendingClaimed = 0;
    let approvedClaimed = 0;
    let reimbursedClaimed = 0;

    claims.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalClaimed += amt;
      if (c.status === "pending" || c.status === "pending_finance") {
        pendingClaimed += amt;
      } else if (c.status === "approved") {
        approvedClaimed += amt;
      } else if (c.status === "reimbursed") {
        reimbursedClaimed += amt;
      }
    });

    return {
      totalClaimed,
      pendingClaimed,
      approvedClaimed,
      reimbursedClaimed,
      count: claims.length,
    };
  }, [claims]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Total Claimed</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(stats.totalClaimed)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Under Review</p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(stats.pendingClaimed)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Approved (Queued)</p>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatCurrency(stats.approvedClaimed)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Reimbursed</p>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stats.reimbursedClaimed)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> My Expense Claims
              </CardTitle>
              <CardDescription className="text-xs">
                Submit bills, track multi-level approval states, and check reimbursement payouts.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-1.5 text-xs h-8 shadow-sm font-medium"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Submit Expense Claim</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : claims.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <Receipt className="mx-auto h-8 w-8 opacity-40 mb-2" />
              No expense claims filed yet. Click "Submit Expense Claim" to submit a receipt.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Title & Notes</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Receipt</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {claims.map((c) => {
                    const statusConfig = STATUS_CONFIG[c.status] || {
                      label: c.status,
                      badgeClass: "bg-muted text-muted-foreground",
                    };

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedClaimId(c.id)}
                        className="hover:bg-muted/20 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 max-w-xs">
                          <p className="font-semibold text-foreground">{c.title}</p>
                          {c.notes && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {c.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {c.category}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(c.expense_date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                          {formatCurrency(Number(c.amount))}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.receipt_url || c.receipt_storage_path ? (
                            <span className="text-primary font-medium inline-flex items-center gap-1 text-[11px]">
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Attached</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px] italic">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className={`text-[10px] ${statusConfig.badgeClass}`}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 hover:text-primary"
                            onClick={() => setSelectedClaimId(c.id)}
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Expense Modal */}
      <CreateExpenseDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        employeeId={employeeId}
        onSuccess={() => refetch()}
      />

      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        claimId={selectedClaimId}
        open={!!selectedClaimId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedClaimId(null);
        }}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
