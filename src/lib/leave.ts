import { toDateKey } from "@/lib/attendance";

export interface Holiday {
  date: string;
  title: string;
}

export interface LeaveBalance {
  id: string;
  leave_type_id: string;
  year: number;
  total: number;
  used: number;
  remaining: number;
  leave_types?: {
    id: string;
    name: string;
    days_per_year: number;
    is_paid: boolean;
  };
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days: number;
  half_day: boolean;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  manager_id: string | null;
  manager_comment: string | null;
  admin_id: string | null;
  admin_comment: string | null;
  applied_at: string;
  decided_at: string | null;
  employees?: {
    id: string;
    full_name: string;
    employee_code: string;
    department_id: string | null;
    departments?: { name: string } | null;
  } | null;
  leave_types?: {
    id: string;
    name: string;
    is_paid: boolean;
  } | null;
}

/**
 * Calculates working leave days between two dates, excluding weekly offs and holidays.
 */
export function calculateWorkingLeaveDays(
  fromDateStr: string,
  toDateStr: string,
  halfDay: boolean = false,
  holidays: Holiday[] = [],
  weeklyOffDays: number[] = [0], // 0 = Sunday
): { days: number; excludedWeeklyOffs: number; excludedHolidays: number; breakdown: string[] } {
  if (!fromDateStr || !toDateStr) {
    return { days: 0, excludedWeeklyOffs: 0, excludedHolidays: 0, breakdown: [] };
  }

  const start = new Date(fromDateStr + "T00:00:00");
  const end = new Date(toDateStr + "T00:00:00");

  if (end < start) {
    return { days: 0, excludedWeeklyOffs: 0, excludedHolidays: 0, breakdown: [] };
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

    if (weeklyOffDays.includes(dayOfWeek)) {
      excludedWeeklyOffs++;
      breakdown.push(`${key}: Weekly Off (skipped)`);
    } else if (holidayDates.has(key)) {
      excludedHolidays++;
      const h = holidays.find((item) => item.date === key);
      breakdown.push(`${key}: Holiday - ${h?.title || "Holiday"} (skipped)`);
    } else {
      workingDays++;
      breakdown.push(`${key}: Leave Day`);
    }

    cur.setDate(cur.getDate() + 1);
  }

  const finalDays = halfDay ? (workingDays > 0 ? 0.5 : 0) : workingDays;
  return {
    days: finalDays,
    excludedWeeklyOffs,
    excludedHolidays,
    breakdown,
  };
}

/**
 * Checks for date overlap against existing active/pending leave requests.
 */
export function checkLeaveOverlap(
  fromDateStr: string,
  toDateStr: string,
  existingRequests: LeaveRequest[],
  excludeRequestId?: string,
): boolean {
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
