import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExpenseClaim,
  STATUS_CONFIG,
  EXPENSE_CATEGORIES,
  formatCurrency,
} from "@/lib/expenses";
import { formatDate } from "@/lib/attendance";
import { CreateExpenseDialog } from "./CreateExpenseDialog";
import { ExpenseDetailModal } from "./ExpenseDetailModal";

export function ExpenseClaimsLedger() {
  const session = useSession();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Fetch Claims
  const {
    data: claims = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["expense-claims"],
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
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ExpenseClaim[];
    },
  });

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesEmployee = c.employee?.full_name?.toLowerCase().includes(query);
        const matchesCategory = c.category.toLowerCase().includes(query);
        const matchesRef = c.reimbursement_reference?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesEmployee && !matchesCategory && !matchesRef) {
          return false;
        }
      }

      return true;
    });
  }, [claims, statusFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <Card className="border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search claim, employee, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="pending">Pending Manager</SelectItem>
                <SelectItem value="pending_finance">Pending Finance</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="reimbursed">Reimbursed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Category: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Category: All</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-9 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="h-9 gap-1.5 font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Expense</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
              <tr>
                <th className="p-3 pl-4">Claim Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Expense Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Receipt</th>
                <th className="p-3">Approval Status</th>
                <th className="p-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading expense claims ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-semibold text-foreground text-sm">No expense claims found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery || statusFilter !== "all"
                        ? "Try clearing your search query or filters."
                        : "No expense claims have been submitted yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClaims.map((c) => {
                  const statusConf = STATUS_CONFIG[c.status];

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedClaimId(c.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3 pl-4 font-semibold text-foreground max-w-[240px] truncate">
                        {c.title}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] bg-muted font-normal">
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
                          <span className="text-primary font-medium text-[11px] inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Proof Attached</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">None</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusConf?.badgeClass}>
                          {statusConf?.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClaimId(c.id);
                          }}
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <CreateExpenseDialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Detail Modal */}
      <ExpenseDetailModal
        claimId={selectedClaimId}
        open={!!selectedClaimId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedClaimId(null);
        }}
        onUpdated={() => {
          refetch();
        }}
      />
    </div>
  );
}
