// ============================================================================
// PERFORMANCE MANAGEMENT TYPES & HELPERS
// ============================================================================

export type PerformanceCycleType = "monthly" | "quarterly" | "annual";

export type PerformanceCycleStatus = "draft" | "active" | "evaluation" | "closed";

export type GoalType = "individual" | "department" | "kpi";

export type GoalStatus =
  | "not_started"
  | "in_progress"
  | "achieved"
  | "exceeded"
  | "cancelled";

export type ReviewStage =
  | "self_review"
  | "manager_review"
  | "hr_calibration"
  | "completed";

export type ManagerRecommendation =
  | "exceeds_expectations"
  | "meets_expectations"
  | "needs_improvement"
  | "unsatisfactory";

export interface PerformanceCycle {
  id: string;
  organization_id?: string | null;
  title: string;
  cycle_type: PerformanceCycleType | string;
  start_date: string;
  due_date: string;
  description?: string | null;
  status: PerformanceCycleStatus | string;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PerformanceGoal {
  id: string;
  organization_id?: string | null;
  employee_id: string;
  department_id?: string | null;
  cycle_id?: string | null;
  title: string;
  description?: string | null;
  goal_type: GoalType | string;
  metric?: string | null;
  target_value?: number | null;
  current_value?: number | null;
  unit?: string | null;
  weightage?: number | null;
  progress: number;
  status: GoalStatus | string;
  start_date?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
    department?: { name: string } | null;
  } | null;
  department?: { name: string } | null;
  cycle?: { title: string } | null;
}

export interface PerformanceReview {
  id: string;
  organization_id?: string | null;
  employee_id: string;
  reviewer_id?: string | null;
  cycle_id?: string | null;
  review_period: string;
  rating?: number | null;
  goals?: string | null;
  feedback?: string | null;
  status: string;
  self_rating?: number | null;
  self_achievements?: string | null;
  self_growth_areas?: string | null;
  self_comments?: string | null;
  self_submitted_at?: string | null;
  manager_rating?: number | null;
  manager_feedback?: string | null;
  manager_strengths?: string | null;
  manager_development_plan?: string | null;
  manager_recommendation?: ManagerRecommendation | string | null;
  manager_submitted_at?: string | null;
  final_score?: number | null;
  final_grade?: string | null;
  hr_comments?: string | null;
  stage: ReviewStage | string;
  created_at: string;
  updated_at?: string | null;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
    photo_url?: string | null;
    department_id?: string | null;
    departments?: { name: string } | null;
    manager_id?: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
  } | null;
  cycle?: {
    id: string;
    title: string;
    cycle_type: string;
    due_date: string;
  } | null;
}

export interface PerformancePeerFeedback {
  id: string;
  organization_id?: string | null;
  review_id?: string | null;
  employee_id: string;
  peer_id: string;
  relationship: string;
  rating?: number | null;
  strengths?: string | null;
  areas_for_improvement?: string | null;
  comments?: string | null;
  is_anonymous: boolean;
  status: "requested" | "submitted" | "declined" | string;
  submitted_at?: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
  } | null;
  peer?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
  } | null;
}

export function getGoalStatusBadge(status?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case "achieved":
      return {
        label: "Achieved",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    case "exceeded":
      return {
        label: "Exceeded Target",
        colorClass: "bg-emerald-600 text-white border-emerald-600 font-bold",
      };
    case "in_progress":
      return {
        label: "In Progress",
        colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      };
    case "not_started":
      return {
        label: "Not Started",
        colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    default:
      return {
        label: status || "Pending",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function getReviewStageBadge(stage?: string | null): {
  label: string;
  colorClass: string;
  step: number;
} {
  switch (stage) {
    case "self_review":
      return {
        label: "Self Assessment Pending",
        colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        step: 1,
      };
    case "manager_review":
      return {
        label: "Manager Evaluation Pending",
        colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
        step: 2,
      };
    case "hr_calibration":
      return {
        label: "HR Calibration",
        colorClass: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
        step: 3,
      };
    case "completed":
      return {
        label: "Appraisal Completed",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        step: 4,
      };
    default:
      return {
        label: stage || "Pending",
        colorClass: "bg-muted text-muted-foreground border-border",
        step: 0,
      };
  }
}

export function getGradeBadge(grade?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (grade) {
    case "Outstanding":
      return {
        label: "Outstanding (O)",
        colorClass: "bg-emerald-600 text-white font-bold border-emerald-600",
      };
    case "Exceeds Expectations":
      return {
        label: "Exceeds Expectations (EE)",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold",
      };
    case "Meets Expectations":
      return {
        label: "Meets Expectations (ME)",
        colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      };
    case "Needs Improvement":
      return {
        label: "Needs Improvement (NI)",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    default:
      return {
        label: grade || "Unassigned",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function calculateWeightedScore(
  selfRating?: number | null,
  managerRating?: number | null,
  selfWeight = 0.4,
  managerWeight = 0.6
): number {
  if (selfRating && managerRating) {
    return Number((selfRating * selfWeight + managerRating * managerWeight).toFixed(1));
  }
  if (managerRating) return Number(managerRating.toFixed(1));
  if (selfRating) return Number(selfRating.toFixed(1));
  return 0;
}

export function calculateGoalCompletionStats(goals: PerformanceGoal[]): {
  total: number;
  completed: number;
  inProgress: number;
  averageProgress: number;
} {
  if (!goals || goals.length === 0) {
    return { total: 0, completed: 0, inProgress: 0, averageProgress: 0 };
  }
  const completed = goals.filter((g) => g.status === "achieved" || g.status === "exceeded" || g.progress >= 100).length;
  const inProgress = goals.filter((g) => g.status === "in_progress").length;
  const totalProgress = goals.reduce((acc, g) => acc + (g.progress || 0), 0);
  const averageProgress = Math.round(totalProgress / goals.length);

  return {
    total: goals.length,
    completed,
    inProgress,
    averageProgress,
  };
}
