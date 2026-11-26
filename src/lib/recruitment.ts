import { supabase } from "@/integrations/supabase/client";

export type CandidateStage =
  | "applied"
  | "screening"
  | "shortlisted"
  | "interview"
  | "selected"
  | "offer"
  | "hired"
  | "rejected";

export type OfferStatus = "not_offered" | "offered" | "accepted" | "declined";

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type InterviewRecommendation = "strong_hire" | "hire" | "hold" | "reject";

export type WorkplaceType = "onsite" | "hybrid" | "remote";

export type EmploymentType = "full_time" | "part_time" | "contract" | "internship";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "executive";

export interface JobOpening {
  id: string;
  organization_id?: string | null;
  title: string;
  description?: string | null;
  department_id?: string | null;
  experience_level?: string | null;
  employment_type?: string | null;
  workplace_type?: string | null;
  location?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  currency?: string | null;
  openings_count?: number | null;
  status: "draft" | "published" | "closed" | "on_hold" | string;
  hiring_manager_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  departments?: { name: string } | null;
  hiring_manager?: { full_name: string; employee_code: string } | null;
  candidates_count?: number;
}

export interface Candidate {
  id: string;
  organization_id?: string | null;
  job_opening_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  current_company?: string | null;
  current_designation?: string | null;
  years_of_experience?: number | null;
  current_salary?: number | null;
  expected_salary?: number | null;
  notice_period_days?: number | null;
  resume_url?: string | null;
  resume_file_name?: string | null;
  portfolio_url?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
  stage: CandidateStage | string;
  rejection_reason?: string | null;
  rejection_notes?: string | null;
  offer_salary?: number | null;
  offer_status: OfferStatus | string;
  offer_date?: string | null;
  offer_accepted_date?: string | null;
  joining_date?: string | null;
  rating?: number | null;
  notes?: string | null;
  converted_employee_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  job_openings?: {
    id: string;
    title: string;
    department_id?: string | null;
    departments?: { name: string } | null;
  } | null;
}

export interface CandidateInterview {
  id: string;
  organization_id?: string | null;
  candidate_id: string;
  job_opening_id: string;
  interviewer_id: string;
  round_name: string;
  round_number?: number | null;
  scheduled_at: string;
  duration_minutes?: number | null;
  meeting_link?: string | null;
  location?: string | null;
  status: InterviewStatus | string;
  rating?: number | null;
  recommendation?: InterviewRecommendation | string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  feedback?: string | null;
  feedback_submitted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  interviewer?: {
    id: string;
    full_name: string;
    employee_code: string;
    designation?: string | null;
  } | null;
  candidate?: {
    id: string;
    full_name: string;
    email: string;
    stage?: string | null;
  } | null;
  job_opening?: {
    id: string;
    title: string;
  } | null;
}

export interface CandidateActivity {
  id: string;
  candidate_id: string;
  performed_by?: string | null;
  action: string;
  from_stage?: string | null;
  to_stage?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  title: string;
  file_url: string;
  file_name?: string | null;
  file_size?: number | null;
  category?: string | null;
  created_at: string;
}

export const RECRUITMENT_STAGES: {
  key: CandidateStage;
  label: string;
  description: string;
}[] = [
  { key: "applied", label: "Applied", description: "Fresh applicant submission" },
  { key: "screening", label: "Screening", description: "Profile screening" },
  { key: "shortlisted", label: "Shortlisted", description: "Approved for interview rounds" },
  { key: "interview", label: "Interview", description: "Active evaluation rounds in progress" },
  { key: "selected", label: "Selected", description: "Recommended for offer" },
  { key: "offer", label: "Offer", description: "Offer extended / under negotiation" },
  { key: "hired", label: "Hired", description: "Offer accepted & converted to employee" },
  { key: "rejected", label: "Rejected", description: "Candidate not selected or declined" },
];

export const REJECTION_REASONS = [
  { key: "skills_mismatch", label: "Skills / Technical Mismatch" },
  { key: "experience_insufficient", label: "Insufficient Experience" },
  { key: "salary_expectation", label: "Salary Expectation Out of Budget" },
  { key: "culture_fit", label: "Cultural / Behavioral Fit" },
  { key: "notice_period", label: "Notice Period Too Long" },
  { key: "candidate_declined", label: "Candidate Declined / Withdrew" },
  { key: "another_candidate_selected", label: "Position Filled by Another Candidate" },
  { key: "duplicate", label: "Duplicate Application" },
  { key: "other", label: "Other" },
];

export const INTERVIEW_ROUND_TYPES = [
  "Initial Recruiter Screen",
  "Technical Round 1 (Coding / Problem Solving)",
  "Technical Round 2 (System Design / Architecture)",
  "Hiring Manager Interview",
  "Product & Cultural Fit",
  "Executive Leadership Round",
];

export function getCandidateStageBadge(stage?: string | null): {
  label: string;
  colorClass: string;
  variant: CandidateStage | "default";
} {
  switch (stage) {
    case "applied":
      return {
        label: "Applied",
        colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
        variant: "applied",
      };
    case "screening":
      return {
        label: "Screening",
        colorClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
        variant: "screening",
      };
    case "shortlisted":
      return {
        label: "Shortlisted",
        colorClass: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
        variant: "shortlisted",
      };
    case "interview":
      return {
        label: "In Interview",
        colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold",
        variant: "interview",
      };
    case "selected":
      return {
        label: "Selected",
        colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold",
        variant: "selected",
      };
    case "offer":
      return {
        label: "Offer Extended",
        colorClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 font-semibold",
        variant: "offer",
      };
    case "hired":
      return {
        label: "Hired & Converted",
        colorClass: "bg-emerald-600 text-white border-emerald-600 font-bold",
        variant: "hired",
      };
    case "rejected":
      return {
        label: "Rejected",
        colorClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
        variant: "rejected",
      };
    default:
      return {
        label: stage || "Unknown",
        colorClass: "bg-muted text-muted-foreground border-border",
        variant: "default",
      };
  }
}

export function getOfferStatusBadge(status?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case "accepted":
      return {
        label: "Offer Accepted",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    case "offered":
      return {
        label: "Offer Pending",
        colorClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
      };
    case "declined":
      return {
        label: "Offer Declined",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    default:
      return {
        label: "Not Offered",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function getInterviewStatusBadge(status?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    case "scheduled":
      return {
        label: "Scheduled",
        colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    case "no_show":
      return {
        label: "No Show",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
    default:
      return {
        label: status || "Pending",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function getRecommendationBadge(rec?: string | null): {
  label: string;
  colorClass: string;
} {
  switch (rec) {
    case "strong_hire":
      return {
        label: "Strong Hire",
        colorClass: "bg-emerald-600 text-white border-emerald-600 font-bold",
      };
    case "hire":
      return {
        label: "Hire",
        colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    case "hold":
      return {
        label: "Hold / Maybe",
        colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      };
    case "reject":
      return {
        label: "Reject",
        colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    default:
      return {
        label: "Pending Evaluation",
        colorClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function formatSalary(amount?: number | null, currency = "INR"): string {
  if (!amount || amount <= 0) return "Not specified";
  if (currency === "INR") {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} LPA`;
    return `₹${amount.toLocaleString("en-IN")}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}
