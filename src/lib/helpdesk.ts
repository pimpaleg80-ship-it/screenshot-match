import { supabase } from "@/integrations/supabase/client";

export type TicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface HrTicket {
  id: string;
  ticket_number: string;
  employee_id: string;
  organization_id: string | null;
  subject: string;
  category: string;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  assigned_to: string | null;
  assigned_employee_id: string | null;
  resolution_notes: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
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
  assigned_employee?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface HrTicketCategory {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface HrTicketComment {
  id: string;
  ticket_id: string;
  organization_id: string | null;
  author_user_id: string | null;
  author_employee_id: string | null;
  author_name: string | null;
  author_role: string | null;
  message: string;
  is_internal: boolean;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
}

export interface HrTicketHistory {
  id: string;
  ticket_id: string;
  organization_id: string | null;
  changed_by_user_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
}

export const TICKET_CATEGORIES = [
  "Attendance complaints",
  "Leave queries",
  "Payroll queries",
  "General HR requests",
  "Benefits & Insurance",
  "Workplace & IT Support",
] as const;

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; badgeClass: string; dotClass: string; step: number }
> = {
  open: {
    label: "Open",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    dotClass: "bg-blue-500",
    step: 1,
  },
  assigned: {
    label: "Assigned",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    dotClass: "bg-indigo-500",
    step: 2,
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dotClass: "bg-amber-500",
    step: 3,
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
    step: 4,
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
    step: 5,
  },
};

export const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; badgeClass: string; iconClass: string }
> = {
  low: {
    label: "Low",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    iconClass: "text-slate-500",
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    iconClass: "text-blue-500",
  },
  high: {
    label: "High",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    iconClass: "text-amber-500",
  },
  urgent: {
    label: "Urgent",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 font-bold animate-pulse",
    iconClass: "text-rose-500",
  },
};

/**
 * Generates a signed URL for a ticket attachment stored in the private 'helpdesk-attachments' bucket.
 */
export async function getAttachmentSignedUrl(
  pathOrUrl: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.replace(/^helpdesk-attachments\//, "");
  const { data, error } = await supabase.storage
    .from("helpdesk-attachments")
    .createSignedUrl(cleanPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return pathOrUrl;
  }
  return data.signedUrl;
}

export function formatTicketFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
