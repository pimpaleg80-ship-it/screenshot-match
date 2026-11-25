export type AnnouncementCategory =
  | "announcement"
  | "news"
  | "circular"
  | "policy_update"
  | "celebration";

export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export type SurveyType =
  | "poll"
  | "survey"
  | "feedback_form"
  | "suggestion_box"
  | "satisfaction";

export type SurveyStatus = "draft" | "active" | "closed" | "archived";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating_scale"
  | "text"
  | "boolean"
  | "nps";

export type SuggestionCategory =
  | "Operations"
  | "Workplace Culture"
  | "Technology & Tools"
  | "Cost Saving"
  | "Wellness"
  | "Other";

export type SuggestionStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "implemented"
  | "declined";

export interface Announcement {
  id: string;
  organization_id: string | null;
  title: string;
  message: string;
  summary: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  attachment_url: string | null;
  target: string;
  target_department_id: string | null;
  target_employee_ids: string[] | null;
  pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  department?: {
    id: string;
    name: string;
  } | null;
  author_profile?: {
    full_name: string;
    email: string;
  } | null;
  read_by_me?: boolean;
  read_count?: number;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  employee_id: string;
  user_id: string | null;
  organization_id: string | null;
  read_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    department?: {
      name: string;
    } | null;
  } | null;
}

export interface EngagementSurvey {
  id: string;
  organization_id: string;
  created_by_user_id: string | null;
  title: string;
  description: string | null;
  type: SurveyType;
  status: SurveyStatus;
  target_audience: "all" | "department";
  target_department_id: string | null;
  is_anonymous: boolean;
  show_live_results: boolean;
  allow_multiple_submissions: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  target_department?: {
    id: string;
    name: string;
  } | null;
  questions_count?: number;
  responses_count?: number;
  has_participated?: boolean;
}

export interface EngagementQuestion {
  id: string;
  survey_id: string;
  organization_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  order_index: number;
  scale_min: number | null;
  scale_max: number | null;
  created_at: string;
}

export interface EngagementResponse {
  id: string;
  survey_id: string;
  organization_id: string;
  employee_id: string | null;
  user_id: string | null;
  respondent_hash: string | null;
  is_anonymous: boolean;
  submitted_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    department?: {
      name: string;
    } | null;
  } | null;
  answers?: EngagementAnswer[];
}

export interface EngagementAnswer {
  id: string;
  response_id: string;
  question_id: string;
  survey_id: string;
  organization_id: string;
  answer_text: string | null;
  selected_options: string[] | null;
  rating_value: number | null;
  boolean_value: boolean | null;
  created_at: string;
}

export interface EmployeeSuggestion {
  id: string;
  organization_id: string;
  employee_id: string | null;
  user_id: string | null;
  is_anonymous: boolean;
  title: string;
  description: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  upvotes_count: number;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    department?: {
      name: string;
    } | null;
  } | null;
  upvoted_by_me?: boolean;
}

export const ANNOUNCEMENT_CATEGORY_CONFIG: Record<
  AnnouncementCategory,
  { label: string; badgeClass: string; iconName: string }
> = {
  announcement: {
    label: "Announcement",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    iconName: "Megaphone",
  },
  news: {
    label: "Internal News",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    iconName: "Newspaper",
  },
  circular: {
    label: "Official Circular",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    iconName: "FileText",
  },
  policy_update: {
    label: "Policy Update",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    iconName: "ShieldAlert",
  },
  celebration: {
    label: "Celebration & Kudos",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    iconName: "Sparkles",
  },
};

export const ANNOUNCEMENT_PRIORITY_CONFIG: Record<
  AnnouncementPriority,
  { label: string; badgeClass: string }
> = {
  low: {
    label: "Low Priority",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
  },
  normal: {
    label: "Normal",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  high: {
    label: "High Priority",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  urgent: {
    label: "Urgent",
    badgeClass: "bg-rose-600 text-white animate-pulse font-semibold",
  },
};

export const SURVEY_TYPE_CONFIG: Record<
  SurveyType,
  { label: string; description: string; badgeClass: string; iconName: string }
> = {
  poll: {
    label: "Quick Poll",
    description: "Single question poll for instant team consensus and live sentiment",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    iconName: "BarChart2",
  },
  survey: {
    label: "Employee Survey",
    description: "Multi-question comprehensive survey on organizational matters",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    iconName: "ClipboardList",
  },
  feedback_form: {
    label: "Feedback Form",
    description: "Structured form for collecting specific operational or event feedback",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    iconName: "MessageSquare",
  },
  suggestion_box: {
    label: "Innovation & Suggestions",
    description: "Open suggestion repository for employee ideas and improvement initiatives",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    iconName: "Lightbulb",
  },
  satisfaction: {
    label: "eNPS & Satisfaction",
    description: "Employee Net Promoter Score and periodic happiness metric",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    iconName: "Smile",
  },
};

export const SURVEY_STATUS_CONFIG: Record<
  SurveyStatus,
  { label: string; badgeClass: string }
> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
  },
  active: {
    label: "Active & Accepting",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-200 dark:border-zinc-800",
  },
};

export const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  "Operations",
  "Workplace Culture",
  "Technology & Tools",
  "Cost Saving",
  "Wellness",
  "Other",
];

export const SUGGESTION_STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; badgeClass: string }
> = {
  submitted: {
    label: "Submitted",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  under_review: {
    label: "Under Review",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  planned: {
    label: "Planned for Implementation",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  implemented: {
    label: "Implemented",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-medium",
  },
  declined: {
    label: "Declined",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  },
};

/**
 * Calculates Employee Net Promoter Score (eNPS)
 * Promoters: 9-10
 * Passives: 7-8
 * Detractors: 1-6
 * eNPS = ((Promoters - Detractors) / Total) * 100
 */
export function calculateENPS(ratings: number[]): {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
} {
  if (!ratings || ratings.length === 0) {
    return {
      score: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      total: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  ratings.forEach((val) => {
    const num = Math.round(val);
    if (num >= 9) promoters++;
    else if (num >= 7) passives++;
    else if (num >= 1) detractors++;
  });

  const total = promoters + passives + detractors;
  if (total === 0) {
    return {
      score: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      total: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
    };
  }

  const promoterPct = Math.round((promoters / total) * 100);
  const passivePct = Math.round((passives / total) * 100);
  const detractorPct = Math.round((detractors / total) * 100);
  const score = Math.round(((promoters - detractors) / total) * 100);

  return {
    score,
    promoters,
    passives,
    detractors,
    total,
    promoterPct,
    passivePct,
    detractorPct,
  };
}

/**
 * Computes average of numerical ratings
 */
export function calculateAverageRating(ratings: number[]): number {
  if (!ratings || ratings.length === 0) return 0;
  const valid = ratings.filter((r) => typeof r === "number" && !isNaN(r));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

/**
 * Calculates distribution and percentage breakdown for multiple or single choice answers
 */
export function calculateOptionDistribution(
  answers: { selected_options?: string[] | null; answer_text?: string | null }[],
  options: string[]
): { option: string; count: number; percentage: number }[] {
  if (!options || options.length === 0) return [];

  const counts: Record<string, number> = {};
  options.forEach((opt) => {
    counts[opt] = 0;
  });

  let totalVotes = 0;

  answers.forEach((ans) => {
    if (ans.selected_options && Array.isArray(ans.selected_options)) {
      ans.selected_options.forEach((opt) => {
        if (counts[opt] !== undefined) {
          counts[opt] = (counts[opt] ?? 0) + 1;
          totalVotes++;
        }
      });
    } else if (ans.answer_text) {
      if (counts[ans.answer_text] !== undefined) {
        counts[ans.answer_text] = (counts[ans.answer_text] ?? 0) + 1;
        totalVotes++;
      }
    }
  });

  return options.map((opt) => {
    const count = counts[opt] || 0;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return {
      option: opt,
      count,
      percentage,
    };
  });
}
