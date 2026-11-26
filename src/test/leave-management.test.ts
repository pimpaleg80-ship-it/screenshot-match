import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  calculateWorkingLeaveDays,
  checkLeaveOverlap,
  getLeaveRequestDisplayStatus,
  type LeaveRequest,
  type Holiday,
} from "@/lib/leave";

describe("Leave Management - Working Leave Days Calculation", () => {
  const holidays: Holiday[] = [
    { date: "2026-06-03", title: "Midweek Holiday" }, // Wednesday
    { date: "2026-06-10", title: "Another Holiday" },
  ];

  it("calculates working days within a normal work week (Mon-Tue, no holidays)", () => {
    // 2026-06-01 is Monday, 2026-06-02 is Tuesday
    const result = calculateWorkingLeaveDays(
      "2026-06-01",
      "2026-06-02",
      false,
      holidays,
      [0, 6], // Sun, Sat
      false
    );

    expect(result.days).toBe(2);
    expect(result.excludedWeeklyOffs).toBe(0);
    expect(result.excludedHolidays).toBe(0);
  });

  it("excludes weekly offs (Saturday and Sunday)", () => {
    // 2026-06-05 is Friday, 2026-06-08 is Monday (spanning Sat 6th and Sun 7th)
    const result = calculateWorkingLeaveDays(
      "2026-06-05",
      "2026-06-08",
      false,
      [],
      [0, 6], // Sat, Sun off
      false
    );

    expect(result.days).toBe(2); // Friday + Monday
    expect(result.excludedWeeklyOffs).toBe(2);
    expect(result.excludedHolidays).toBe(0);
  });

  it("excludes official holidays falling on working days", () => {
    // 2026-06-01 (Mon) to 2026-06-04 (Thu), with Wed 2026-06-03 as a holiday
    const result = calculateWorkingLeaveDays(
      "2026-06-01",
      "2026-06-04",
      false,
      holidays,
      [0, 6],
      false
    );

    expect(result.days).toBe(3); // Mon, Tue, Thu
    expect(result.excludedHolidays).toBe(1);
    expect(result.excludedWeeklyOffs).toBe(0);
  });

  it("computes half-day leave as 0.5 days", () => {
    // 2026-06-01 (Mon) half day
    const result = calculateWorkingLeaveDays(
      "2026-06-01",
      "2026-06-01",
      true,
      holidays,
      [0, 6],
      false
    );

    expect(result.days).toBe(0.5);
  });

  it("returns 0 days if date range falls completely on weekend or holidays", () => {
    // 2026-06-06 (Sat) to 2026-06-07 (Sun)
    const result = calculateWorkingLeaveDays(
      "2026-06-06",
      "2026-06-07",
      false,
      holidays,
      [0, 6],
      false
    );

    expect(result.days).toBe(0);
    expect(result.excludedWeeklyOffs).toBe(2);
  });

  it("applies sandwich rule when active: includes intervening weekends in deduction", () => {
    // 2026-06-05 (Fri) to 2026-06-08 (Mon)
    // Fri (working), Sat (weekend), Sun (weekend), Mon (working)
    // With sandwich rule = true: all 4 days are deducted
    const resultWithSandwich = calculateWorkingLeaveDays(
      "2026-06-05",
      "2026-06-08",
      false,
      [],
      [0, 6],
      true // sandwich rule enabled
    );

    expect(resultWithSandwich.days).toBe(4);
    expect(resultWithSandwich.isSandwichApplied).toBe(true);

    // Without sandwich rule: only Fri and Mon = 2 days
    const resultWithoutSandwich = calculateWorkingLeaveDays(
      "2026-06-05",
      "2026-06-08",
      false,
      [],
      [0, 6],
      false
    );

    expect(resultWithoutSandwich.days).toBe(2);
    expect(resultWithoutSandwich.isSandwichApplied).toBe(false);
  });
});

describe("Leave Management - Overlap Detection", () => {
  const existingRequests: LeaveRequest[] = [
    {
      id: "req-1",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-06-10",
      to_date: "2026-06-12",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Family trip",
      attachment_url: null,
      status: "approved",
      current_approval_level: "completed",
      manager_id: null,
      manager_comment: null,
      manager_decision: "approved",
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: "approved",
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-06-01T00:00:00Z",
      decided_at: "2026-06-02T00:00:00Z",
    },
    {
      id: "req-2",
      employee_id: "emp-1",
      leave_type_id: "lt-sl",
      from_date: "2026-06-20",
      to_date: "2026-06-22",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Fever",
      attachment_url: null,
      status: "pending",
      current_approval_level: "manager",
      manager_id: null,
      manager_comment: null,
      manager_decision: null,
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-06-15T00:00:00Z",
      decided_at: null,
    },
    {
      id: "req-3",
      employee_id: "emp-1",
      leave_type_id: "lt-el",
      from_date: "2026-06-25",
      to_date: "2026-06-28",
      days: 4,
      half_day: false,
      half_day_period: null,
      reason: "Cancelled plan",
      attachment_url: null,
      status: "cancelled",
      current_approval_level: null,
      manager_id: null,
      manager_comment: null,
      manager_decision: null,
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: "2026-06-20T00:00:00Z",
      cancelled_by: "emp-1",
      cancellation_reason: "Plan change",
      organization_id: null,
      applied_at: "2026-06-18T00:00:00Z",
      decided_at: null,
    },
    {
      id: "req-4",
      employee_id: "emp-1",
      leave_type_id: "lt-el",
      from_date: "2026-07-01",
      to_date: "2026-07-05",
      days: 5,
      half_day: false,
      half_day_period: null,
      reason: "Rejected request",
      attachment_url: null,
      status: "rejected",
      current_approval_level: null,
      manager_id: null,
      manager_comment: "Staffing shortage",
      manager_decision: "rejected",
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-06-18T00:00:00Z",
      decided_at: "2026-06-19T00:00:00Z",
    },
  ];

  it("detects exact overlap with an approved request", () => {
    expect(checkLeaveOverlap("2026-06-10", "2026-06-12", existingRequests)).toBe(true);
  });

  it("detects partial overlap when new request begins during existing leave", () => {
    expect(checkLeaveOverlap("2026-06-11", "2026-06-15", existingRequests)).toBe(true);
  });

  it("detects partial overlap when new request ends during existing leave", () => {
    expect(checkLeaveOverlap("2026-06-08", "2026-06-11", existingRequests)).toBe(true);
  });

  it("detects overlap when new request completely encompasses existing leave", () => {
    expect(checkLeaveOverlap("2026-06-09", "2026-06-14", existingRequests)).toBe(true);
  });

  it("detects overlap with a pending request", () => {
    expect(checkLeaveOverlap("2026-06-21", "2026-06-23", existingRequests)).toBe(true);
  });

  it("ignores cancelled and rejected requests (does not flag overlap)", () => {
    // Dates match req-3 (cancelled) and req-4 (rejected)
    expect(checkLeaveOverlap("2026-06-25", "2026-06-28", existingRequests)).toBe(false);
    expect(checkLeaveOverlap("2026-07-01", "2026-07-05", existingRequests)).toBe(false);
  });

  it("allows non-overlapping dates", () => {
    expect(checkLeaveOverlap("2026-06-01", "2026-06-05", existingRequests)).toBe(false);
    expect(checkLeaveOverlap("2026-06-13", "2026-06-19", existingRequests)).toBe(false);
    expect(checkLeaveOverlap("2026-07-06", "2026-07-10", existingRequests)).toBe(false);
  });

  it("excludes current requestId during edits or resubmissions", () => {
    // Checking overlap against req-1 while ignoring req-1 id
    expect(checkLeaveOverlap("2026-06-10", "2026-06-12", existingRequests, "req-1")).toBe(false);
  });
});

describe("Leave Management - Multi-tier Approval Status Display", () => {
  it("displays 'Pending Manager Review' when pending at manager tier", () => {
    const req: LeaveRequest = {
      id: "req-10",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-08-01",
      to_date: "2026-08-03",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Vacation",
      attachment_url: null,
      status: "pending",
      current_approval_level: "manager",
      manager_id: "mgr-1",
      manager_comment: null,
      manager_decision: null,
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-07-25T00:00:00Z",
      decided_at: null,
    };

    const status = getLeaveRequestDisplayStatus(req);
    expect(status.label).toBe("Pending Manager Review");
    expect(status.step).toBe(1);
  });

  it("displays 'Pending HR Approval' when manager has approved and waiting on admin", () => {
    const req: LeaveRequest = {
      id: "req-11",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-08-01",
      to_date: "2026-08-03",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Vacation",
      attachment_url: null,
      status: "pending",
      current_approval_level: "admin",
      manager_id: "mgr-1",
      manager_comment: "Looks good",
      manager_decision: "approved",
      manager_decision_at: "2026-07-26T00:00:00Z",
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-07-25T00:00:00Z",
      decided_at: null,
    };

    const status = getLeaveRequestDisplayStatus(req);
    expect(status.label).toBe("Pending HR Approval");
    expect(status.step).toBe(2);
  });

  it("displays 'Approved' when finalized", () => {
    const req: LeaveRequest = {
      id: "req-12",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-08-01",
      to_date: "2026-08-03",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Vacation",
      attachment_url: null,
      status: "approved",
      current_approval_level: "completed",
      manager_id: "mgr-1",
      manager_comment: "Approved",
      manager_decision: "approved",
      manager_decision_at: "2026-07-26T00:00:00Z",
      admin_id: "adm-1",
      admin_comment: "Final approval",
      admin_decision: "approved",
      admin_decision_at: "2026-07-27T00:00:00Z",
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-07-25T00:00:00Z",
      decided_at: "2026-07-27T00:00:00Z",
    };

    const status = getLeaveRequestDisplayStatus(req);
    expect(status.label).toBe("Approved");
    expect(status.step).toBe(3);
  });

  it("displays 'Rejected' when rejected by manager or HR", () => {
    const req: LeaveRequest = {
      id: "req-13",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-08-01",
      to_date: "2026-08-03",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Vacation",
      attachment_url: null,
      status: "rejected",
      current_approval_level: null,
      manager_id: "mgr-1",
      manager_comment: "Critical deliverable due",
      manager_decision: "rejected",
      manager_decision_at: "2026-07-26T00:00:00Z",
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      organization_id: null,
      applied_at: "2026-07-25T00:00:00Z",
      decided_at: "2026-07-26T00:00:00Z",
    };

    const status = getLeaveRequestDisplayStatus(req);
    expect(status.label).toBe("Rejected");
    expect(status.step).toBe(0);
  });

  it("displays 'Cancelled' when cancelled by employee or admin", () => {
    const req: LeaveRequest = {
      id: "req-14",
      employee_id: "emp-1",
      leave_type_id: "lt-cl",
      from_date: "2026-08-01",
      to_date: "2026-08-03",
      days: 3,
      half_day: false,
      half_day_period: null,
      reason: "Vacation",
      attachment_url: null,
      status: "cancelled",
      current_approval_level: null,
      manager_id: null,
      manager_comment: null,
      manager_decision: null,
      manager_decision_at: null,
      admin_id: null,
      admin_comment: null,
      admin_decision: null,
      admin_decision_at: null,
      cancelled_at: "2026-07-26T00:00:00Z",
      cancelled_by: "emp-1",
      cancellation_reason: "Rescheduled",
      organization_id: null,
      applied_at: "2026-07-25T00:00:00Z",
      decided_at: null,
    };

    const status = getLeaveRequestDisplayStatus(req);
    expect(status.label).toBe("Cancelled");
    expect(status.step).toBe(0);
  });

  it("ensures migration 20261126123500 avoids generated remaining updates and broken RPC calls", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20261126123500_fix_broken_db_functions_and_security.sql"),
      "utf8"
    );
    expect(sql).not.toMatch(/UPDATE\s+public\.leave_balances[\s\S]*?\bremaining\s*=/i);
    expect(sql).toContain("app.leave_tx_handled");
    expect(sql).toContain("'request_id', v_new_req_id");
    expect(sql).toContain("PERFORM public.allocate_annual_leaves(\n    EXTRACT(YEAR FROM CURRENT_DATE)::integer,");
    expect(sql).not.toContain("updated_at = now()\n  WHERE id = p_document_id");
    expect(sql).not.toMatch(/VALUES\s*\([^;]*?v_corr\.date::text/i);
    expect(sql).toContain("v_corr.date,\n      v_in_ts,\n      v_out_ts");

    const leavesUi = fs.readFileSync(
      path.resolve(process.cwd(), "src/routes/_authenticated/leaves.tsx"),
      "utf8"
    );
    expect(leavesUi).toContain("resJson.leave_request_id ?? resJson.request_id");
  });
});
