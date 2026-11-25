export type OnboardingStatus =
  | "draft"
  | "in_progress"
  | "pending_hr_review"
  | "completed"
  | "cancelled";

export type OnboardingTaskCategory =
  | "document"
  | "it_setup"
  | "hr_verification"
  | "personal_info"
  | "bank_details"
  | "policy_sign";

export type OnboardingTaskStatus =
  | "pending"
  | "submitted"
  | "verified"
  | "rejected"
  | "completed"
  | "skipped";

export interface OnboardingTemplate {
  id: string;
  organization_id?: string | null;
  name: string;
  description?: string | null;
  department_id?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at?: string | null;
  items_count?: number;
}

export interface OnboardingChecklistItem {
  id: string;
  template_id: string;
  title: string;
  description?: string | null;
  category: OnboardingTaskCategory;
  required: boolean;
  order_index: number;
  document_category?: string | null;
}

export interface EmployeeOnboardingTask {
  id: string;
  onboarding_id: string;
  employee_id: string;
  title: string;
  description?: string | null;
  category: OnboardingTaskCategory | string;
  required: boolean;
  status: OnboardingTaskStatus | string;
  document_id?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  rejection_notes?: string | null;
  order_index: number;
  created_at: string;
  documents?: {
    id: string;
    title: string;
    file_url: string;
    file_name?: string | null;
    verification_status?: string | null;
  } | null;
}

export interface EmployeeOnboardingRecord {
  id: string;
  employee_id: string;
  organization_id?: string | null;
  template_id?: string | null;
  status: OnboardingStatus | string;
  progress_percentage: number;
  target_completion_date?: string | null;
  completed_at?: string | null;
  hr_reviewer_id?: string | null;
  hr_notes?: string | null;
  offer_letter_url?: string | null;
  offer_letter_accepted_at?: string | null;
  employment_agreement_url?: string | null;
  employment_agreement_accepted_at?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_branch?: string | null;
  bank_account_holder?: string | null;
  pan_number?: string | null;
  created_at: string;
  updated_at?: string | null;
  employees?: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    phone?: string | null;
    joining_date?: string | null;
    designation?: string | null;
    department_id?: string | null;
    departments?: { name: string } | null;
    manager_id?: string | null;
  } | null;
  onboarding_templates?: {
    name: string;
  } | null;
  tasks?: EmployeeOnboardingTask[];
}

/**
 * Returns label and styling badge for onboarding pipeline statuses.
 */
export function getOnboardingStatusBadge(status?: string | null): {
  label: string;
  colorClass: string;
  variant: "in_progress" | "pending_review" | "completed" | "draft" | "cancelled";
} {
  switch (status) {
    case "completed":
      return {
        label: "Onboarding Completed",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        variant: "completed",
      };
    case "pending_hr_review":
      return {
        label: "Pending HR Review",
        colorClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
        variant: "pending_review",
      };
    case "in_progress":
      return {
        label: "In Progress",
        colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        variant: "in_progress",
      };
    case "draft":
      return {
        label: "Pre-Onboarding Draft",
        colorClass: "bg-muted text-muted-foreground border-border",
        variant: "draft",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
        variant: "cancelled",
      };
    default:
      return {
        label: "Not Started",
        colorClass: "bg-muted text-muted-foreground border-border",
        variant: "draft",
      };
  }
}

/**
 * Returns human-readable metadata for task categories.
 */
export function getTaskCategoryBadge(category?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (category) {
    case "document":
      return {
        label: "Document Submission",
        colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
      };
    case "bank_details":
      return {
        label: "Bank & Tax Info",
        colorClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
      };
    case "personal_info":
      return {
        label: "Personal Details",
        colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
      };
    case "policy_sign":
      return {
        label: "Policy Sign-off",
        colorClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
      };
    case "it_setup":
      return {
        label: "IT & System Access",
        colorClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900",
      };
    case "hr_verification":
      return {
        label: "HR Verification",
        colorClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
      };
    default:
      return {
        label: "Task",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}
