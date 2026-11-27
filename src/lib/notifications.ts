import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "leave"
  | "attendance"
  | "shift"
  | "expense"
  | "ticket"
  | "document_expiry"
  | "interview"
  | "performance"
  | "payroll"
  | "announcement"
  | "general";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "email" | "whatsapp";
export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface NotificationItem {
  id: string;
  user_id: string;
  organization_id: string | null;
  employee_id: string | null;
  title: string;
  message: string | null;
  link: string | null;
  type: NotificationType | string;
  priority: NotificationPriority | string;
  channel: NotificationChannel | string;
  delivery_status: DeliveryStatus | string;
  provider_message_id: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  id?: string;
  user_id: string;
  organization_id?: string | null;
  employee_id?: string | null;
  in_app_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  notify_leave: boolean;
  notify_attendance: boolean;
  notify_shift: boolean;
  notify_expense: boolean;
  notify_ticket: boolean;
  notify_document_expiry: boolean;
  notify_interview: boolean;
  notify_performance: boolean;
  notify_payroll: boolean;
  notify_announcement: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, "id" | "user_id"> = {
  in_app_enabled: true,
  email_enabled: true,
  whatsapp_enabled: false,
  whatsapp_number: null,
  notify_leave: true,
  notify_attendance: true,
  notify_shift: true,
  notify_expense: true,
  notify_ticket: true,
  notify_document_expiry: true,
  notify_interview: true,
  notify_performance: true,
  notify_payroll: true,
  notify_announcement: true,
};

export interface NotificationTypeMeta {
  label: string;
  badgeClass: string;
  defaultLink: string;
}

export function getNotificationTypeMeta(type: string): NotificationTypeMeta {
  switch (type) {
    case "leave":
      return {
        label: "Leave",
        badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
        defaultLink: "/leaves",
      };
    case "attendance":
      return {
        label: "Attendance",
        badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
        defaultLink: "/attendance",
      };
    case "shift":
      return {
        label: "Shift",
        badgeClass: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
        defaultLink: "/shifts",
      };
    case "expense":
      return {
        label: "Expense",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        defaultLink: "/expenses",
      };
    case "ticket":
      return {
        label: "HR Ticket",
        badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
        defaultLink: "/helpdesk",
      };
    case "document_expiry":
      return {
        label: "Document Expiry",
        badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
        defaultLink: "/documents",
      };
    case "interview":
      return {
        label: "Recruitment",
        badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
        defaultLink: "/recruitment",
      };
    case "performance":
      return {
        label: "Performance",
        badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
        defaultLink: "/performance",
      };
    case "payroll":
      return {
        label: "Payroll",
        badgeClass: "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
        defaultLink: "/payroll",
      };
    case "announcement":
      return {
        label: "Announcement",
        badgeClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
        defaultLink: "/announcements",
      };
    default:
      return {
        label: "General",
        badgeClass: "bg-muted text-muted-foreground border-border",
        defaultLink: "/dashboard",
      };
  }
}

export function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-rose-500 text-white font-bold animate-pulse";
    case "high":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
    case "low":
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

// ---------------------------------------------------------------------------
// Supabase Data Access & Mutation
// ---------------------------------------------------------------------------

export async function fetchUserNotifications(
  userId: string,
  filterUnreadOnly = false,
  typeFilter = "all"
): Promise<NotificationItem[]> {
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filterUnreadOnly) {
    query = query.eq("is_read", false);
  }

  if (typeFilter && typeFilter !== "all") {
    query = query.eq("type", typeFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as NotificationItem[];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
}

export async function fetchNotificationPreferences(
  userId: string,
  organizationId?: string | null
): Promise<NotificationPreferences> {
  let query = supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  if (data) {
    return data as NotificationPreferences;
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    user_id: userId,
    organization_id: organizationId || null,
  };
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const payload: any = {
    user_id: preferences.user_id,
    organization_id: preferences.organization_id || null,
    employee_id: preferences.employee_id || null,
    in_app_enabled: preferences.in_app_enabled,
    email_enabled: preferences.email_enabled,
    whatsapp_enabled: preferences.whatsapp_enabled,
    whatsapp_number: preferences.whatsapp_number,
    notify_leave: preferences.notify_leave,
    notify_attendance: preferences.notify_attendance,
    notify_shift: preferences.notify_shift,
    notify_expense: preferences.notify_expense,
    notify_ticket: preferences.notify_ticket,
    notify_document_expiry: preferences.notify_document_expiry,
    notify_interview: preferences.notify_interview,
    notify_performance: preferences.notify_performance,
    notify_payroll: preferences.notify_payroll,
    notify_announcement: preferences.notify_announcement,
    updated_at: new Date().toISOString(),
  };

  if (preferences.id) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .update(payload)
      .eq("id", preferences.id)
      .select()
      .single();
    if (error) throw error;
    return data as NotificationPreferences;
  } else {
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id,organization_id" })
      .select()
      .single();
    if (error) throw error;
    return data as NotificationPreferences;
  }
}

export async function runDailyAutomationChecks(organizationId: string) {
  const { data, error } = await supabase.rpc("run_daily_automation_checks", {
    _organization_id: organizationId,
  });
  if (error) throw error;
  return data;
}
