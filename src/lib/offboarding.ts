import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR, numberToWordsIndian } from "@/lib/payroll";

export type ExitType = "resignation" | "termination" | "end_of_contract" | "retirement";
export type ExitStatus =
  | "submitted"
  | "manager_approved"
  | "in_clearance"
  | "clearance_completed"
  | "fnf_settled"
  | "relieved"
  | "rejected"
  | "withdrawn";

export interface EmployeeExit {
  id: string;
  employee_id: string;
  organization_id?: string | null;
  exit_type: ExitType;
  resignation_date: string;
  requested_last_working_day: string;
  agreed_last_working_day: string;
  notice_period_days: number;
  notice_waiver_days: number;
  reason_category: string;
  employee_reason: string;
  status: ExitStatus;
  manager_approval_status: "pending" | "approved" | "rejected";
  manager_approved_by?: string | null;
  manager_approved_at?: string | null;
  manager_notes?: string | null;
  hr_approval_status: "pending" | "approved" | "rejected";
  hr_approved_by?: string | null;
  hr_approved_at?: string | null;
  hr_notes?: string | null;
  exit_interview_status: "pending" | "scheduled" | "completed" | "waived";
  clearance_status: "pending" | "in_progress" | "completed";
  fnf_status: "pending" | "calculated" | "approved" | "settled";
  relieving_letter_issued: boolean;
  relieving_letter_issued_at?: string | null;
  experience_letter_issued: boolean;
  experience_letter_issued_at?: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    joining_date?: string | null;
    designation?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface ExitKtTask {
  id: string;
  exit_id: string;
  organization_id?: string | null;
  title: string;
  description?: string | null;
  assigned_to_employee_id?: string | null;
  status: "pending" | "in_progress" | "completed";
  due_date?: string | null;
  completed_at?: string | null;
  sign_off_by_employee_id?: string | null;
  created_at: string;
  assigned_employee?: {
    id: string;
    full_name: string;
    employee_code: string;
  } | null;
}

export interface ExitAssetReturn {
  id: string;
  exit_id: string;
  organization_id?: string | null;
  asset_name: string;
  asset_type: string;
  serial_number?: string | null;
  status: "allocated" | "returned" | "damaged" | "lost" | "retained";
  returned_date?: string | null;
  verified_by?: string | null;
  replacement_cost?: number | null;
  condition_notes?: string | null;
  created_at: string;
}

export interface ExitClearance {
  id: string;
  exit_id: string;
  organization_id?: string | null;
  department_type: "Reporting Manager" | "IT & Security" | "Finance & Accounts" | "HR & Admin";
  status: "pending" | "cleared" | "flagged";
  cleared_by?: string | null;
  cleared_at?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface ExitInterview {
  id: string;
  exit_id: string;
  organization_id?: string | null;
  conducted_by?: string | null;
  conducted_at: string;
  culture_rating?: number | null;
  management_rating?: number | null;
  growth_rating?: number | null;
  compensation_rating?: number | null;
  work_life_rating?: number | null;
  would_recommend: boolean;
  positive_feedback?: string | null;
  improvement_areas?: string | null;
  reason_for_leaving?: string | null;
  confidential_notes?: string | null;
  created_at: string;
}

export interface ExitFnFSettlement {
  id: string;
  exit_id: string;
  employee_id: string;
  organization_id?: string | null;
  settlement_date: string;
  working_days_in_final_month: number;
  payable_days_in_final_month: number;
  basic_salary_rate: number;
  unpaid_salary_amount: number;
  leave_encashment_days: number;
  leave_encashment_amount: number;
  gratuity_amount: number;
  bonus_incentives: number;
  pending_expense_claims: number;
  notice_shortfall_days: number;
  notice_recovery_amount: number;
  asset_deductions: number;
  statutory_deductions: number;
  other_deductions: number;
  total_earnings: number;
  total_deductions: number;
  net_payable: number;
  status: "draft" | "approved" | "settled";
  approved_by?: string | null;
  approved_at?: string | null;
  settled_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface ExitHistory {
  id: string;
  exit_id: string;
  organization_id?: string | null;
  changed_by_user_id?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  notes?: string | null;
  created_at: string;
}

export const EXIT_REASON_CATEGORIES = [
  "Better Opportunity",
  "Higher Studies",
  "Relocation",
  "Personal & Family",
  "Health & Wellness",
  "Compensation & Benefits",
  "Career Transition",
  "Entrepreneurship",
  "Other",
] as const;

export const CLEARANCE_DEPARTMENTS = [
  "Reporting Manager",
  "IT & Security",
  "Finance & Accounts",
  "HR & Admin",
] as const;

export const EXIT_STATUS_CONFIG: Record<
  ExitStatus,
  { label: string; badgeClass: string; step: number; description: string }
> = {
  submitted: {
    label: "Resignation Submitted",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    step: 1,
    description: "Submitted by employee; awaiting manager/HR approval",
  },
  manager_approved: {
    label: "Manager Approved",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    step: 2,
    description: "Approved by reporting manager; initiating department clearance",
  },
  in_clearance: {
    label: "In Clearance",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    step: 3,
    description: "Department handovers, KT tasks, and asset returns in progress",
  },
  clearance_completed: {
    label: "Clearance Completed",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800",
    step: 4,
    description: "All 4 departments cleared; queued for FnF settlement",
  },
  fnf_settled: {
    label: "FnF Settled",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    step: 5,
    description: "Full and final compensation calculated, approved, and settled",
  },
  relieved: {
    label: "Relieved & Completed",
    badgeClass: "bg-emerald-600 text-white font-semibold",
    step: 6,
    description: "Employee relieved; Relieving & Experience certificates issued",
  },
  rejected: {
    label: "Resignation Rejected",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    step: 0,
    description: "Resignation request declined or cancelled",
  },
  withdrawn: {
    label: "Withdrawn",
    badgeClass: "bg-muted text-muted-foreground border-border",
    step: 0,
    description: "Resignation withdrawn by employee",
  },
};

/**
 * Calculates Full and Final (FnF) Settlement Amounts
 */
export function calculateFnFSettlement({
  basicSalaryRate,
  monthlyGross,
  workingDaysInFinalMonth = 30,
  payableDaysInFinalMonth = 0,
  leaveEncashmentDays = 0,
  gratuityAmount = 0,
  bonusIncentives = 0,
  pendingExpenseClaims = 0,
  noticeShortfallDays = 0,
  assetDeductions = 0,
  statutoryDeductions = 0,
  otherDeductions = 0,
}: {
  basicSalaryRate: number;
  monthlyGross: number;
  workingDaysInFinalMonth?: number;
  payableDaysInFinalMonth?: number;
  leaveEncashmentDays?: number;
  gratuityAmount?: number;
  bonusIncentives?: number;
  pendingExpenseClaims?: number;
  noticeShortfallDays?: number;
  assetDeductions?: number;
  statutoryDeductions?: number;
  otherDeductions?: number;
}) {
  const safeDays = workingDaysInFinalMonth > 0 ? workingDaysInFinalMonth : 30;
  const perDayGross = monthlyGross / safeDays;
  const perDayBasic = basicSalaryRate / safeDays;

  // Earnings
  const unpaidSalaryAmount = Math.round(perDayGross * payableDaysInFinalMonth * 100) / 100;
  const leaveEncashmentAmount = Math.round(perDayBasic * leaveEncashmentDays * 100) / 100;
  const totalEarnings =
    unpaidSalaryAmount +
    leaveEncashmentAmount +
    gratuityAmount +
    bonusIncentives +
    pendingExpenseClaims;

  // Deductions
  const noticeRecoveryAmount = Math.round(perDayGross * noticeShortfallDays * 100) / 100;
  const totalDeductions =
    noticeRecoveryAmount + assetDeductions + statutoryDeductions + otherDeductions;

  const netPayable = Math.max(0, totalEarnings - totalDeductions);

  return {
    unpaidSalaryAmount,
    leaveEncashmentAmount,
    noticeRecoveryAmount,
    totalEarnings,
    totalDeductions,
    netPayable,
  };
}

/**
 * Generates Relieving Letter PDF using jsPDF
 */
export function generateRelievingLetterPDF({
  employee,
  exit,
  organizationName = "FlowPeople Technologies Pvt. Ltd.",
}: {
  employee: {
    full_name: string;
    employee_code: string;
    designation?: string | null | undefined;
    department_name?: string | null | undefined;
    joining_date?: string | null | undefined;
  };
  exit: EmployeeExit;
  organizationName?: string | undefined;
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const todayStr = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
  const lwdStr = new Date(exit.agreed_last_working_day).toLocaleDateString("en-IN", {
    dateStyle: "long",
  });
  const dojStr = employee.joining_date
    ? new Date(employee.joining_date).toLocaleDateString("en-IN", { dateStyle: "long" })
    : "the date of commencement";

  // Company Letterhead Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(organizationName.toUpperCase(), 105, 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Registered Office: Tech Park, Phase II, Bengaluru - 560100, Karnataka, India", 105, 31, {
    align: "center",
  });
  doc.text("Corporate Identity & People Operations | hr@flowpeople.internal", 105, 36, {
    align: "center",
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 42, 190, 42);

  // Date and Reference
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Date: ${todayStr}`, 20, 52);
  doc.text(`Ref No: FP-REL-${employee.employee_code}-${new Date().getFullYear()}`, 20, 58);

  // Recipient
  doc.setFont("helvetica", "bold");
  doc.text("TO WHOMSOEVER IT MAY CONCERN", 105, 72, { align: "center" });

  // Subject
  doc.setFont("helvetica", "bold");
  doc.text(`SUB: RELIEVING LETTER — ${employee.full_name.toUpperCase()} (ID: ${employee.employee_code})`, 20, 84);

  // Body text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);

  const p1 = `This is to certify that ${employee.full_name} (Employee Code: ${employee.employee_code}) was employed with ${organizationName} as "${employee.designation || "Staff Member"}" in the ${employee.department_name || "Engineering"} department from ${dojStr} to ${lwdStr}.`;

  const p2 = `Consequent to the acceptance of your resignation, you have been formally relieved of your responsibilities with the company effective close of business hours on ${lwdStr}.`;

  const p3 = `We confirm that all company property, assets, electronic devices, access credentials, and knowledge transfer responsibilities have been duly accounted for, and your departmental clearances and Full & Final financial settlement have been satisfactorily concluded.`;

  const p4 = `During tenure with us, ${employee.full_name} has demonstrated utmost professionalism, sincerity, and dedication. We wish you every success in all your future professional endeavors and career pursuits.`;

  const splitP1 = doc.splitTextToSize(p1, 170);
  const splitP2 = doc.splitTextToSize(p2, 170);
  const splitP3 = doc.splitTextToSize(p3, 170);
  const splitP4 = doc.splitTextToSize(p4, 170);

  let curY = 96;
  doc.text(splitP1, 20, curY);
  curY += splitP1.length * 6 + 6;

  doc.text(splitP2, 20, curY);
  curY += splitP2.length * 6 + 6;

  doc.text(splitP3, 20, curY);
  curY += splitP3.length * 6 + 6;

  doc.text(splitP4, 20, curY);
  curY += splitP4.length * 6 + 18;

  // Sign-off
  doc.setFont("helvetica", "bold");
  doc.text(`For ${organizationName}`, 20, curY);
  curY += 20;

  doc.text("Authorized Signatory", 20, curY);
  doc.setFont("helvetica", "normal");
  doc.text("Head of Human Resources & People Operations", 20, curY + 5);

  return doc;
}

/**
 * Generates Experience Certificate PDF using jsPDF
 */
export function generateExperienceCertificatePDF({
  employee,
  exit,
  organizationName = "FlowPeople Technologies Pvt. Ltd.",
}: {
  employee: {
    full_name: string;
    employee_code: string;
    designation?: string | null | undefined;
    department_name?: string | null | undefined;
    joining_date?: string | null | undefined;
  };
  exit: EmployeeExit;
  organizationName?: string | undefined;
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const todayStr = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
  const lwdStr = new Date(exit.agreed_last_working_day).toLocaleDateString("en-IN", {
    dateStyle: "long",
  });
  const dojStr = employee.joining_date
    ? new Date(employee.joining_date).toLocaleDateString("en-IN", { dateStyle: "long" })
    : "commencement";

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(organizationName.toUpperCase(), 105, 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Corporate Headquarters | People Operations", 105, 31, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 38, 190, 38);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Date: ${todayStr}`, 20, 48);
  doc.text(`Certificate No: FP-EXP-${employee.employee_code}-${new Date().getFullYear()}`, 20, 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("EXPERIENCE CERTIFICATE", 105, 68, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);

  const text = `This is to certify that ${employee.full_name} (Employee Code: ${employee.employee_code}) was associated with ${organizationName} as a full-time employee from ${dojStr} to ${lwdStr}.\n\nDuring their tenure, they held the position of "${employee.designation || "Software Specialist"}" within the ${employee.department_name || "Technology"} department.\n\nThroughout their period of service, their character and conduct were exemplary. They exhibited commendable problem-solving expertise, collaboration, and diligence in their work assignments.\n\nWe appreciate their valuable contributions to our organization and wish them continued success in their upcoming personal and professional journey.`;

  const splitText = doc.splitTextToSize(text, 170);
  doc.text(splitText, 20, 82);

  // Sign-off
  const signY = 165;
  doc.setFont("helvetica", "bold");
  doc.text(`For ${organizationName}`, 20, signY);
  doc.text("Head - Talent & People Strategy", 20, signY + 22);

  return doc;
}
