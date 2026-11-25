import { toDateKey } from "@/lib/attendance";

export interface Holiday {
  id?: string;
  date: string;
  name?: string;
  title?: string;
  is_optional?: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  code?: string | null;
  days_per_year: number;
  is_paid: boolean;
  active: boolean;
  description?: string | null;
  color?: string | null;
  allow_half_day?: boolean | null;
  allow_carry_forward?: boolean | null;
  max_carry_forward_days?: number | null;
  allow_encashment?: boolean | null;
  max_encashment_days?: number | null;
  requires_approval?: boolean | null;
  requires_manager_approval?: boolean | null;
  requires_hr_approval?: boolean | null;
  max_consecutive_days?: number | null;
  min_service_days_required?: number | null;
  requires_document_proof?: boolean | null;
  document_proof_min_days?: number | null;
  organization_id?: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total: number;
  used: number;
  remaining: number;
  carried_forward?: number | null;
  encashed?: number | null;
  organization_id?: string | null;
  leave_types?: LeaveType | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days: number;
  half_day: boolean;
  half_day_period?: "first_half" | "second_half" | "full_day" | null;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  current_approval_level?: "manager" | "admin" | "completed" | null;
  manager_id: string | null;
  manager_comment: string | null;
  manager_decision?: string | null;
  manager_decision_at?: string | null;
  admin_id: string | null;
  admin_comment: string | null;
  admin_decision?: string | null;
  admin_decision_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  organization_id?: string | null;
  applied_at: string;
  decided_at: string | null;
  employees?: {
    id: string;
    full_name: string;
    employee_code: string;
    photo_url?: string | null;
    department_id: string | null;
    manager_id?: string | null;
    departments?: { name: string } | null;
  } | null;
  leave_types?: LeaveType | null;
}

export interface LeavePolicy {
  id: string;
  organization_id: string | null;
  name: string;
  weekly_off_days: number[];
  approval_flow: "manager_only" | "admin_only" | "manager_then_admin";
  sandwich_rule_enabled: boolean;
  allow_negative_balance: boolean;
  notice_days_required: number;
  is_active: boolean;
}

/**
 * Calculates working leave days between two dates, excluding weekly offs and holidays
 * unless the organization policy enables sandwich rule.
 */
export function calculateWorkingLeaveDays(
  fromDateStr: string,
  toDateStr: string,
  halfDay: boolean = false,
  holidays: Holiday[] = [],
  weeklyOffDays: number[] = [0, 6], // 0 = Sunday, 6 = Saturday
  sandwichRuleEnabled: boolean = false
): {
  days: number;
  excludedWeeklyOffs: number;
  excludedHolidays: number;
  breakdown: string[];
  isSandwichApplied?: boolean;
} {
  if (!fromDateStr || !toDateStr) {
    return { days: 0, excludedWeeklyOffs: 0, excludedHolidays: 0, breakdown: [], isSandwichApplied: false };
  }

  const start = new Date(fromDateStr + "T00:00:00");
  const end = new Date(toDateStr + "T00:00:00");

  if (end < start) {
    return { days: 0, excludedWeeklyOffs: 0, excludedHolidays: 0, breakdown: [], isSandwichApplied: false };
  }

  const holidayDates = new Set(holidays.map((h) => h.date));
  let workingDays = 0;
  let excludedWeeklyOffs = 0;
  let excludedHolidays = 0;
  const breakdown: string[] = [];

  const cur = new Date(start);
  while (cur <= end) {
    const key = toDateKey(cur);
    const dayOfWeek = cur.getDay();

    const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
    const isHoliday = holidayDates.has(key);

    if (sandwichRuleEnabled) {
      // Under sandwich rule, middle weekends and holidays count as leave
      workingDays++;
      if (isWeeklyOff) {
        breakdown.push(`${key}: Weekly Off (included in leave under sandwich rule)`);
      } else if (isHoliday) {
        breakdown.push(`${key}: Holiday (included in leave under sandwich rule)`);
      } else {
        breakdown.push(`${key}: Working Day`);
      }
    } else {
      if (isWeeklyOff) {
        excludedWeeklyOffs++;
        breakdown.push(`${key}: Weekly Off (excluded)`);
      } else if (isHoliday) {
        excludedHolidays++;
        const h = holidays.find((item) => item.date === key);
        const title = h?.name || h?.title || "Holiday";
        breakdown.push(`${key}: Holiday - ${title} (excluded)`);
      } else {
        workingDays++;
        breakdown.push(`${key}: Working Day`);
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  const finalDays = halfDay ? (workingDays > 0 ? 0.5 : 0) : workingDays;
  return {
    days: finalDays,
    excludedWeeklyOffs,
    excludedHolidays,
    breakdown,
    isSandwichApplied: Boolean(sandwichRuleEnabled),
  };
}

/**
 * Checks for date overlap against existing active/pending leave requests.
 */
export function checkLeaveOverlap(
  fromDateStr: string,
  toDateStr: string,
  existingRequests: LeaveRequest[],
  excludeRequestId?: string
): boolean {
  if (!fromDateStr || !toDateStr) return false;
  const reqStart = new Date(fromDateStr + "T00:00:00").getTime();
  const reqEnd = new Date(toDateStr + "T23:59:59").getTime();

  return existingRequests.some((req) => {
    if (excludeRequestId && req.id === excludeRequestId) return false;
    if (req.status !== "pending" && req.status !== "approved") return false;

    const existStart = new Date(req.from_date + "T00:00:00").getTime();
    const existEnd = new Date(req.to_date + "T23:59:59").getTime();

    // Overlap condition: startA <= endB and endA >= startB
    return reqStart <= existEnd && reqEnd >= existStart;
  });
}

export function getLeaveRequestDisplayStatus(req: LeaveRequest): {
  label: string;
  variant: "approved" | "pending_manager" | "pending_admin" | "rejected" | "cancelled";
  colorClass: string;
  step: number;
} {
  if (req.status === "approved") {
    return {
      label: "Approved",
      variant: "approved",
      colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      step: 3,
    };
  }

  if (req.status === "rejected") {
    return {
      label: "Rejected",
      variant: "rejected",
      colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      step: 0,
    };
  }

  if (req.status === "cancelled") {
    return {
      label: "Cancelled",
      variant: "cancelled",
      colorClass: "bg-muted text-muted-foreground border-border",
      step: 0,
    };
  }

  // Pending status with multi-level routing
  if (req.current_approval_level === "admin") {
    return {
      label: "Pending HR Approval",
      variant: "pending_admin",
      colorClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
      step: 2,
    };
  }

  return {
    label: "Pending Manager Review",
    variant: "pending_manager",
    colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    step: 1,
  };
}

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
