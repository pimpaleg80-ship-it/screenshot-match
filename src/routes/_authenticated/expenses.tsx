import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { ExpenseClaimsLedger } from "@/components/expenses/ExpenseClaimsLedger";
import { ExpensesApprovalsQueue } from "@/components/expenses/ExpensesApprovalsQueue";
import { MonthlyExpenseReports } from "@/components/expenses/MonthlyExpenseReports";
import { Receipt, CheckCircle2, BarChart3, Clock, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesRoutePage,
});

function ExpensesRoutePage() {
  const session = useSession();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  return (
    <PageContainer maxWidth="wide">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Expense Claims" }]}
        title="Expense Management & Reimbursement"
        description="Track employee business expenditures, receipts, multi-tier manager & finance approvals, and monthly expenditure reports."
      />

      {/* Tabs */}
      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-lg flex flex-wrap h-auto gap-1">
          <TabsTrigger value="ledger" className="gap-2 text-xs sm:text-sm">
            <Receipt className="w-4 h-4" />
            <span>Claims Ledger</span>
          </TabsTrigger>

          {isManager && (
            <TabsTrigger value="queue" className="gap-2 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Approval Queues</span>
            </TabsTrigger>
          )}

          <TabsTrigger value="reports" className="gap-2 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4" />
            <span>Monthly Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="m-0">
          <ExpenseClaimsLedger />
        </TabsContent>

        {isManager && (
          <TabsContent value="queue" className="m-0">
            <ExpensesApprovalsQueue />
          </TabsContent>
        )}

        <TabsContent value="reports" className="m-0">
          <MonthlyExpenseReports />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}