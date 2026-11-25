import { describe, it, expect } from "vitest";
import {
  calculatePunctualityScore,
  calculateTurnoverRate,
  calculateLeaveUtilizationRate,
  calculateRecruitmentConversionRate,
  calculateTicketResolutionRate,
  calculateTrainingCompletionRate,
  getDatePresetRange,
  ReportsAnalyticsOverview,
} from "@/lib/reports";
import {
  getNotificationTypeMeta,
  getPriorityBadgeClass,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notifications";

describe("Phase 10: Reports & Analytics Calculation Formulas", () => {
  it("calculates punctuality score accurately", () => {
    // 0 present + 0 late -> default 100%
    expect(calculatePunctualityScore(0, 0)).toBe(100);

    // 80 present, 20 late -> 80%
    expect(calculatePunctualityScore(80, 20)).toBe(80);

    // 100 present, 0 late -> 100%
    expect(calculatePunctualityScore(100, 0)).toBe(100);

    // 0 present, 50 late -> 0%
    expect(calculatePunctualityScore(0, 50)).toBe(0);

    // 25 present, 75 late -> 25%
    expect(calculatePunctualityScore(25, 75)).toBe(25);
  });

  it("calculates turnover rate accurately", () => {
    // 0 headcount -> 0%
    expect(calculateTurnoverRate(5, 0)).toBe(0);

    // 5 exits out of 100 employees -> 5%
    expect(calculateTurnoverRate(5, 100)).toBe(5);

    // 2 exits out of 50 employees -> 4%
    expect(calculateTurnoverRate(2, 50)).toBe(4);

    // 0 exits -> 0%
    expect(calculateTurnoverRate(0, 75)).toBe(0);
  });

  it("calculates leave utilization rate", () => {
    expect(calculateLeaveUtilizationRate(0, 0)).toBe(0);
    expect(calculateLeaveUtilizationRate(10, 20)).toBe(50);
    expect(calculateLeaveUtilizationRate(18, 18)).toBe(100);
    expect(calculateLeaveUtilizationRate(5, 25)).toBe(20);
  });

  it("calculates recruitment conversion rate", () => {
    expect(calculateRecruitmentConversionRate(0, 0)).toBe(0);
    // 5 hired out of 100 applied -> 5%
    expect(calculateRecruitmentConversionRate(5, 100)).toBe(5);
    // 3 hired out of 25 applied -> 12%
    expect(calculateRecruitmentConversionRate(3, 25)).toBe(12);
  });

  it("calculates ticket SLA resolution rate", () => {
    expect(calculateTicketResolutionRate(0, 0)).toBe(100);
    expect(calculateTicketResolutionRate(18, 20)).toBe(90);
    expect(calculateTicketResolutionRate(50, 50)).toBe(100);
    expect(calculateTicketResolutionRate(0, 10)).toBe(0);
  });

  it("calculates training course completion rate", () => {
    expect(calculateTrainingCompletionRate(0, 0)).toBe(100);
    expect(calculateTrainingCompletionRate(15, 20)).toBe(75);
    expect(calculateTrainingCompletionRate(40, 40)).toBe(100);
  });

  it("generates correct date preset ranges", () => {
    const range7d = getDatePresetRange("7d");
    expect(range7d.label).toBe("Last 7 Days");
    expect(range7d.startDate).toBeDefined();
    expect(range7d.endDate).toBeDefined();

    const range30d = getDatePresetRange("30d");
    expect(range30d.label).toBe("Last 30 Days");

    const range90d = getDatePresetRange("90d");
    expect(range90d.label).toBe("Last 90 Days");

    const rangeThisMonth = getDatePresetRange("this_month");
    expect(rangeThisMonth.label).toBe("This Month");

    const rangeLastMonth = getDatePresetRange("last_month");
    expect(rangeLastMonth.label).toBe("Last Month");

    const rangeThisYear = getDatePresetRange("this_year");
    expect(rangeThisYear.label).toBe("This Year");

    const customRange = getDatePresetRange("custom", "2026-06-01", "2026-06-30");
    expect(customRange.startDate).toBe("2026-06-01");
    expect(customRange.endDate).toBe("2026-06-30");
    expect(customRange.label).toContain("2026-06-01 to 2026-06-30");
  });
});

describe("Phase 10: Notifications & Alerts Configuration", () => {
  it("provides correct metadata for all notification types", () => {
    const types = [
      "leave",
      "attendance",
      "shift",
      "expense",
      "ticket",
      "document_expiry",
      "onboarding",
      "interview",
      "performance",
      "payroll",
      "announcement",
      "general",
    ];

    for (const t of types) {
      const meta = getNotificationTypeMeta(t);
      expect(meta.label).toBeDefined();
      expect(meta.badgeClass).toBeDefined();
      expect(meta.defaultLink).toBeDefined();
    }

    expect(getNotificationTypeMeta("leave").label).toBe("Leave");
    expect(getNotificationTypeMeta("leave").defaultLink).toBe("/leaves");

    expect(getNotificationTypeMeta("payroll").label).toBe("Payroll");
    expect(getNotificationTypeMeta("payroll").defaultLink).toBe("/payroll");

    expect(getNotificationTypeMeta("ticket").label).toBe("HR Ticket");
    expect(getNotificationTypeMeta("ticket").defaultLink).toBe("/helpdesk");

    expect(getNotificationTypeMeta("unknown_random").label).toBe("General");
  });

  it("assigns appropriate styling for priority levels", () => {
    expect(getPriorityBadgeClass("urgent")).toContain("animate-pulse");
    expect(getPriorityBadgeClass("high")).toContain("text-orange-600");
    expect(getPriorityBadgeClass("low")).toContain("text-slate-500");
    expect(getPriorityBadgeClass("normal")).toContain("text-primary");
  });

  it("configures sane default notification preferences", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_app_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.whatsapp_enabled).toBe(false);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_leave).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_attendance).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_shift).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_expense).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_payroll).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_document_expiry).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.notify_announcement).toBe(true);
  });
});

describe("Phase 10: Analytics Overview Mock Dataset Integrity", () => {
  it("validates full 17 domain metrics data structure", () => {
    const mockOverview: ReportsAnalyticsOverview = {
      headcount: {
        total_employees: 50,
        active_count: 45,
        probation_count: 3,
        notice_count: 2,
        inactive_count: 5,
      },
      department_distribution: [
        { department: "Engineering", headcount: 25 },
        { department: "Sales", headcount: 15 },
        { department: "HR", headcount: 5 },
      ],
      new_hires: [
        {
          id: "emp-1",
          full_name: "John Doe",
          employee_code: "EMP001",
          designation: "Frontend Dev",
          joining_date: "2026-01-15",
        },
      ],
      exits: [
        {
          id: "exit-1",
          full_name: "Jane Smith",
          employee_code: "EMP002",
          resignation_date: "2026-02-01",
          agreed_last_working_day: "2026-03-01",
          reason_category: "Better Opportunity",
          status: "approved",
        },
      ],
      attendance: {
        present_count: 900,
        late_count: 45,
        half_day_count: 10,
        absent_count: 15,
        leave_count: 30,
        total_records: 1000,
        total_overtime_hours: 124.5,
      },
      leaves: {
        casual_leave: 12,
        sick_leave: 8,
        earned_leave: 10,
        total_approved_days: 42,
      },
      shifts: [
        { shift_name: "General Shift", assigned_employees: 35 },
        { shift_name: "Morning Shift", assigned_employees: 10 },
      ],
      recruitment: {
        applied: 120,
        screening: 60,
        shortlisted: 30,
        interview: 18,
        selected: 8,
        offer: 6,
        hired: 5,
        rejected: 53,
      },
      expenses: {
        total_amount: 150000,
        approved_amount: 120000,
        travel_amount: 80000,
        food_amount: 40000,
        claims_count: 24,
      },
      payroll: {
        total_gross: 2500000,
        total_net: 2150000,
        total_pf: 180000,
        total_pt: 12000,
        total_tds: 158000,
        runs_count: 2,
      },
      tickets: {
        total_tickets: 40,
        open_tickets: 6,
        resolved_tickets: 34,
        attendance_queries: 14,
        leave_queries: 12,
        payroll_queries: 8,
      },
      training: {
        total_enrollments: 45,
        completed: 36,
        in_progress: 7,
        enrolled: 2,
      },
      performance: {
        total_reviews: 45,
        completed_reviews: 42,
        avg_rating: 4.4,
      },
    };

    expect(mockOverview.headcount.total_employees).toBe(50);
    expect(calculatePunctualityScore(mockOverview.attendance.present_count, mockOverview.attendance.late_count)).toBe(95);
    expect(calculateTurnoverRate(mockOverview.exits.length, mockOverview.headcount.total_employees)).toBe(2);
    expect(calculateTicketResolutionRate(mockOverview.tickets.resolved_tickets, mockOverview.tickets.total_tickets)).toBe(85);
    expect(calculateTrainingCompletionRate(mockOverview.training.completed, mockOverview.training.total_enrollments)).toBe(80);
    expect(mockOverview.payroll.total_gross).toBeGreaterThan(mockOverview.payroll.total_net);
  });
});
