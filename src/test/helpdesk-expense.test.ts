import { describe, it, expect } from "vitest";
import {
  STATUS_CONFIG as HELPDESK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  TICKET_CATEGORIES,
  formatTicketFileSize,
  TicketStatus,
  TicketPriority,
} from "../lib/helpdesk";
import {
  STATUS_CONFIG as EXPENSE_STATUS_CONFIG,
  EXPENSE_CATEGORIES,
  formatCurrency,
  formatExpenseFileSize,
  calculateMonthlyExpenseSummary,
  ExpenseClaim,
} from "../lib/expenses";

describe("Phase 07: HR Helpdesk & Expense Management", () => {
  describe("Module 1: HR Helpdesk", () => {
    it("defines the standard HR Helpdesk categories", () => {
      expect(TICKET_CATEGORIES).toContain("Attendance complaints");
      expect(TICKET_CATEGORIES).toContain("Leave queries");
      expect(TICKET_CATEGORIES).toContain("Payroll queries");
      expect(TICKET_CATEGORIES).toContain("General HR requests");
    });

    it("maps ticket status workflow correctly in order", () => {
      const statuses: TicketStatus[] = ["open", "assigned", "in_progress", "resolved", "closed"];
      statuses.forEach((status, idx) => {
        expect(HELPDESK_STATUS_CONFIG[status]).toBeDefined();
        expect(HELPDESK_STATUS_CONFIG[status].step).toBe(idx + 1);
      });
    });

    it("configures all ticket priority levels", () => {
      const priorities: TicketPriority[] = ["low", "medium", "high", "urgent"];
      priorities.forEach((priority) => {
        expect(PRIORITY_CONFIG[priority]).toBeDefined();
        expect(PRIORITY_CONFIG[priority].label.toLowerCase()).toBe(priority);
      });
    });

    it("formats ticket attachment file sizes accurately", () => {
      expect(formatTicketFileSize(null)).toBe("0 KB");
      expect(formatTicketFileSize(0)).toBe("0 KB");
      expect(formatTicketFileSize(512)).toBe("1 KB");
      expect(formatTicketFileSize(2048)).toBe("2 KB");
      expect(formatTicketFileSize(1500 * 1024)).toBe("1.5 MB");
    });
  });

  describe("Module 2: Expense Management", () => {
    it("defines standard expense categories", () => {
      expect(EXPENSE_CATEGORIES).toContain("Travel expenses");
      expect(EXPENSE_CATEGORIES).toContain("Food expenses");
      expect(EXPENSE_CATEGORIES).toContain("Accommodation");
      expect(EXPENSE_CATEGORIES).toContain("Transport");
    });

    it("maps multi-stage expense status workflow correctly", () => {
      expect(EXPENSE_STATUS_CONFIG.pending.step).toBe(1);
      expect(EXPENSE_STATUS_CONFIG.pending_finance.step).toBe(2);
      expect(EXPENSE_STATUS_CONFIG.approved.step).toBe(3);
      expect(EXPENSE_STATUS_CONFIG.reimbursed.step).toBe(4);
      expect(EXPENSE_STATUS_CONFIG.rejected.step).toBe(0);
    });

    it("formats INR currency accurately", () => {
      const formatted = formatCurrency(12500);
      expect(formatted).toContain("12,500");
      expect(formatCurrency(0)).toContain("0.00");
    });

    it("formats expense receipt file sizes accurately", () => {
      expect(formatExpenseFileSize(undefined)).toBe("0 KB");
      expect(formatExpenseFileSize(0)).toBe("0 KB");
      expect(formatExpenseFileSize(1024)).toBe("1 KB");
      expect(formatExpenseFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
    });

    it("calculates monthly expense report summary with empty claims", () => {
      const summary = calculateMonthlyExpenseSummary([]);
      expect(summary.totalClaimed).toBe(0);
      expect(summary.totalApproved).toBe(0);
      expect(summary.totalReimbursed).toBe(0);
      expect(summary.totalPending).toBe(0);
      expect(summary.totalRejected).toBe(0);
      expect(summary.claimsCount).toBe(0);
      expect(summary.categoryBreakdown).toHaveLength(0);
      expect(summary.departmentBreakdown).toHaveLength(0);
    });

    it("calculates totals, category breakdown, and department breakdown across claims", () => {
      const mockClaims: ExpenseClaim[] = [
        {
          id: "claim-1",
          employee_id: "emp-1",
          organization_id: "org-1",
          title: "Flight to Mumbai client office",
          category: "Travel expenses",
          amount: 5000,
          currency: "INR",
          expense_date: "2026-11-10",
          receipt_url: "receipts/travel.pdf",
          receipt_storage_path: "receipts/travel.pdf",
          receipt_name: "travel.pdf",
          receipt_size: 102400,
          notes: "Client on-site kick-off",
          status: "reimbursed",
          current_approval_level: "completed",
          approved_by: "mgr-1",
          admin_notes: null,
          manager_approved_by: "mgr-1",
          manager_approved_at: "2026-11-11T10:00:00Z",
          manager_notes: "Approved",
          finance_approved_by: "fin-1",
          finance_approved_at: "2026-11-12T10:00:00Z",
          finance_notes: "Verified",
          reimbursed_by: "fin-1",
          reimbursed_at: "2026-11-13T10:00:00Z",
          reimbursement_reference: "NEFT-991823",
          payment_method: "bank_transfer",
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
          created_at: "2026-11-10T09:00:00Z",
          updated_at: "2026-11-13T10:00:00Z",
          employee: {
            id: "emp-1",
            full_name: "Aarav Sharma",
            email: "aarav@example.com",
            department: { id: "dept-eng", name: "Engineering" },
          },
        },
        {
          id: "claim-2",
          employee_id: "emp-2",
          organization_id: "org-1",
          title: "Client Dinner",
          category: "Food expenses",
          amount: 2000,
          currency: "INR",
          expense_date: "2026-11-12",
          receipt_url: null,
          receipt_storage_path: null,
          receipt_name: null,
          receipt_size: null,
          notes: "Dinner with partner team",
          status: "approved",
          current_approval_level: "completed",
          approved_by: "mgr-1",
          admin_notes: null,
          manager_approved_by: "mgr-1",
          manager_approved_at: "2026-11-13T10:00:00Z",
          manager_notes: "Approved",
          finance_approved_by: "fin-1",
          finance_approved_at: "2026-11-14T10:00:00Z",
          finance_notes: "Approved for batch payout",
          reimbursed_by: null,
          reimbursed_at: null,
          reimbursement_reference: null,
          payment_method: null,
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
          created_at: "2026-11-12T14:00:00Z",
          updated_at: "2026-11-14T10:00:00Z",
          employee: {
            id: "emp-2",
            full_name: "Priya Patel",
            email: "priya@example.com",
            department: { id: "dept-sales", name: "Sales" },
          },
        },
        {
          id: "claim-3",
          employee_id: "emp-1",
          organization_id: "org-1",
          title: "Hotel Stay",
          category: "Accommodation",
          amount: 3000,
          currency: "INR",
          expense_date: "2026-11-15",
          receipt_url: null,
          receipt_storage_path: null,
          receipt_name: null,
          receipt_size: null,
          notes: "Hotel bill",
          status: "pending",
          current_approval_level: "manager",
          approved_by: null,
          admin_notes: null,
          manager_approved_by: null,
          manager_approved_at: null,
          manager_notes: null,
          finance_approved_by: null,
          finance_approved_at: null,
          finance_notes: null,
          reimbursed_by: null,
          reimbursed_at: null,
          reimbursement_reference: null,
          payment_method: null,
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
          created_at: "2026-11-15T10:00:00Z",
          updated_at: "2026-11-15T10:00:00Z",
          employee: {
            id: "emp-1",
            full_name: "Aarav Sharma",
            email: "aarav@example.com",
            department: { id: "dept-eng", name: "Engineering" },
          },
        },
        {
          id: "claim-4",
          employee_id: "emp-3",
          organization_id: "org-1",
          title: "Unsupported gadget",
          category: "Office Supplies",
          amount: 1500,
          currency: "INR",
          expense_date: "2026-11-16",
          receipt_url: null,
          receipt_storage_path: null,
          receipt_name: null,
          receipt_size: null,
          notes: "Not pre-approved",
          status: "rejected",
          current_approval_level: "manager",
          approved_by: null,
          admin_notes: null,
          manager_approved_by: null,
          manager_approved_at: null,
          manager_notes: null,
          finance_approved_by: null,
          finance_approved_at: null,
          finance_notes: null,
          reimbursed_by: null,
          reimbursed_at: null,
          reimbursement_reference: null,
          payment_method: null,
          rejected_by: "mgr-2",
          rejected_at: "2026-11-16T12:00:00Z",
          rejection_reason: "Not eligible under remote expense policy",
          created_at: "2026-11-16T08:00:00Z",
          updated_at: "2026-11-16T12:00:00Z",
          employee: {
            id: "emp-3",
            full_name: "Dev Singh",
            email: "dev@example.com",
            department: { id: "dept-eng", name: "Engineering" },
          },
        },
      ];

      const summary = calculateMonthlyExpenseSummary(mockClaims);

      expect(summary.claimsCount).toBe(4);
      expect(summary.totalClaimed).toBe(11500); // 5000 + 2000 + 3000 + 1500
      expect(summary.totalReimbursed).toBe(5000);
      expect(summary.reimbursedCount).toBe(1);
      expect(summary.totalApproved).toBe(2000);
      expect(summary.approvedCount).toBe(1);
      expect(summary.totalPending).toBe(3000);
      expect(summary.pendingCount).toBe(1);
      expect(summary.totalRejected).toBe(1500);
      expect(summary.rejectedCount).toBe(1);

      // Category breakdown (sorted by amount desc)
      expect(summary.categoryBreakdown[0]?.category).toBe("Travel expenses");
      expect(summary.categoryBreakdown[0]?.amount).toBe(5000);
      expect(Math.round(summary.categoryBreakdown[0]?.percentage ?? 0)).toBe(43); // 5000 / 11500 = 43.48%

      // Department breakdown (sorted by amount desc)
      // Engineering: 5000 + 3000 + 1500 = 9500
      // Sales: 2000
      expect(summary.departmentBreakdown[0]?.department).toBe("Engineering");
      expect(summary.departmentBreakdown[0]?.amount).toBe(9500);
      expect(summary.departmentBreakdown[1]?.department).toBe("Sales");
      expect(summary.departmentBreakdown[1]?.amount).toBe(2000);
    });
  });
});
