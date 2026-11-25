import { supabase } from "@/integrations/supabase/client";

export type ExpenseStatus = "pending" | "pending_finance" | "approved" | "reimbursed" | "rejected";
export type ApprovalLevel = "manager" | "finance" | "completed";

export interface ExpenseClaim {
  id: string;
  employee_id: string;
  organization_id: string | null;
  title: string;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url: string | null;
  receipt_storage_path: string | null;
  receipt_name: string | null;
  receipt_size: number | null;
  notes: string | null;
  status: ExpenseStatus;
  current_approval_level: ApprovalLevel;
  approved_by: string | null;
  admin_notes: string | null;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  manager_notes: string | null;
  finance_approved_by: string | null;
  finance_approved_at: string | null;
  finance_notes: string | null;
  reimbursed_by: string | null;
  reimbursed_at: string | null;
  reimbursement_reference: string | null;
  payment_method: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    email: string;
    department?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface ExpenseCategory {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ExpenseHistory {
  id: string;
  expense_id: string;
  organization_id: string | null;
  changed_by_user_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
}

export const EXPENSE_CATEGORIES = [
  "Travel expenses",
  "Food expenses",
  "Accommodation",
  "Transport",
  "Office Supplies",
  "Training & Certifications",
  "Client Entertainment",
  "Other Reimbursable",
] as const;

export const STATUS_CONFIG: Record<
  ExpenseStatus,
  { label: string; badgeClass: string; step: number; description: string }
> = {
  pending: {
    label: "Pending Manager",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    step: 1,
    description: "Awaiting primary reporting manager review & approval",
  },
  pending_finance: {
    label: "Pending Finance/HR",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    step: 2,
    description: "Approved by manager; awaiting Finance/HR verification",
  },
  approved: {
    label: "Approved for Reimbursement",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    step: 3,
    description: "Fully approved; queued for disbursement payout",
  },
  reimbursed: {
    label: "Reimbursed",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-semibold",
    step: 4,
    description: "Payment disbursed and settled to employee account",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    step: 0,
    description: "Claim was reviewed and declined",
  },
};

export function formatCurrency(amount: number, currency = "INR"): string {
  if (isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a signed URL for an expense receipt stored in private 'expense-receipts' bucket.
 */
export async function getReceiptSignedUrl(
  pathOrUrl: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.replace(/^expense-receipts\//, "");
  const { data, error } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrl(cleanPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return pathOrUrl;
  }
  return data.signedUrl;
}

export function formatExpenseFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export interface MonthlyExpenseReportSummary {
  totalClaimed: number;
  totalApproved: number;
  totalReimbursed: number;
  totalPending: number;
  totalRejected: number;
  claimsCount: number;
  approvedCount: number;
  reimbursedCount: number;
  pendingCount: number;
  rejectedCount: number;
  categoryBreakdown: { category: string; amount: number; count: number; percentage: number }[];
  departmentBreakdown: { department: string; amount: number; count: number }[];
}

export function calculateMonthlyExpenseSummary(claims: ExpenseClaim[]): MonthlyExpenseReportSummary {
  let totalClaimed = 0;
  let totalApproved = 0;
  let totalReimbursed = 0;
  let totalPending = 0;
  let totalRejected = 0;

  let approvedCount = 0;
  let reimbursedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  const categoryMap = new Map<string, { amount: number; count: number }>();
  const deptMap = new Map<string, { amount: number; count: number }>();

  claims.forEach((c) => {
    const amt = Number(c.amount) || 0;
    totalClaimed += amt;

    if (c.status === "reimbursed") {
      totalReimbursed += amt;
      reimbursedCount++;
    } else if (c.status === "approved") {
      totalApproved += amt;
      approvedCount++;
    } else if (c.status === "pending" || c.status === "pending_finance") {
      totalPending += amt;
      pendingCount++;
    } else if (c.status === "rejected") {
      totalRejected += amt;
      rejectedCount++;
    }

    // Category
    const cat = c.category || "Other Reimbursable";
    const existingCat = categoryMap.get(cat) || { amount: 0, count: 0 };
    categoryMap.set(cat, {
      amount: existingCat.amount + amt,
      count: existingCat.count + 1,
    });

    // Department
    const dept = c.employee?.department?.name || "General";
    const existingDept = deptMap.get(dept) || { amount: 0, count: 0 };
    deptMap.set(dept, {
      amount: existingDept.amount + amt,
      count: existingDept.count + 1,
    });
  });

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, val]) => ({
    category,
    amount: val.amount,
    count: val.count,
    percentage: totalClaimed > 0 ? (val.amount / totalClaimed) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  const departmentBreakdown = Array.from(deptMap.entries()).map(([department, val]) => ({
    department,
    amount: val.amount,
    count: val.count,
  })).sort((a, b) => b.amount - a.amount);

  return {
    totalClaimed,
    totalApproved,
    totalReimbursed,
    totalPending,
    totalRejected,
    claimsCount: claims.length,
    approvedCount,
    reimbursedCount,
    pendingCount,
    rejectedCount,
    categoryBreakdown,
    departmentBreakdown,
  };
}
