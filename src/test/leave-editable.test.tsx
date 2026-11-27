import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeaveApprovalsManager } from "@/components/leaves/LeaveApprovalsManager";
import { EditLeaveBalanceDialog } from "@/components/leaves/EditLeaveBalanceDialog";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const mockRpc = vi.fn();

const mockRequests = [
  {
    id: "req-pending",
    employee_id: "emp-2",
    leave_type_id: "lt-cl",
    from_date: "2026-12-01",
    to_date: "2026-12-02",
    days: 2,
    half_day: false,
    half_day_period: "full_day",
    reason: "Family event",
    attachment_url: null,
    status: "pending",
    current_approval_level: "manager",
    manager_id: "emp-mgr",
    manager_comment: null,
    manager_decision: "pending",
    manager_decision_at: null,
    admin_id: null,
    admin_comment: null,
    admin_decision: "pending",
    admin_decision_at: null,
    applied_at: "2026-11-20T09:00:00Z",
    decided_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    employees: {
      id: "emp-2",
      full_name: "Asha Rao",
      employee_code: "EMP-002",
      department_id: "dept-1",
      manager_id: "emp-mgr",
      departments: { name: "Engineering" },
    },
    leave_types: { id: "lt-cl", name: "Casual Leave", code: "CL", is_paid: true, color: "#3b82f6" },
  },
  {
    id: "req-approved",
    employee_id: "emp-3",
    leave_type_id: "lt-sl",
    from_date: "2026-11-10",
    to_date: "2026-11-10",
    days: 1,
    half_day: false,
    half_day_period: "full_day",
    reason: "Doctor visit",
    attachment_url: null,
    status: "approved",
    current_approval_level: "completed",
    manager_id: "emp-mgr",
    manager_comment: "Take care",
    manager_decision: "approved",
    manager_decision_at: "2026-11-09T10:00:00Z",
    admin_id: "emp-hr",
    admin_comment: "Approved by HR",
    admin_decision: "approved",
    admin_decision_at: "2026-11-09T12:00:00Z",
    applied_at: "2026-11-09T08:00:00Z",
    decided_at: "2026-11-09T12:00:00Z",
    cancelled_at: null,
    cancellation_reason: null,
    employees: {
      id: "emp-3",
      full_name: "Vikram Patel",
      employee_code: "EMP-003",
      department_id: "dept-1",
      manager_id: "emp-mgr",
      departments: { name: "Engineering" },
    },
    leave_types: { id: "lt-sl", name: "Sick Leave", code: "SL", is_paid: true, color: "#ef4444" },
  },
];

const mockLeaveTypes = [
  { id: "lt-cl", name: "Casual Leave", code: "CL", is_paid: true, active: true, days_per_year: 12 },
  { id: "lt-sl", name: "Sick Leave", code: "SL", is_paid: true, active: true, days_per_year: 10 },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table === "leave_requests") {
        return {
          select: () => ({
            order: async () => ({ data: mockRequests, error: null }),
          }),
        };
      }
      if (table === "leave_types") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: mockLeaveTypes, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      };
    },
  },
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("HR & Admin Leave Editing Across All Levels", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it(
    "allows HR/Admin to filter all leaves and edit an already-approved leave via edit_leave_request_transactional",
    async () => {
      renderWithQuery(
        <LeaveApprovalsManager
          currentEmployeeId="emp-hr"
          isAdmin={false}
          isManager={true}
          isHrOrAdmin={true}
        />
      );

      const allLeavesBtn = await screen.findByRole("button", { name: "All Leaves" });
      fireEvent.click(allLeavesBtn);

      expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
      expect(await screen.findByText("Vikram Patel")).toBeInTheDocument();

      const editButtons = screen.getAllByRole("button", { name: /Edit/i });
      expect(editButtons.length).toBe(2);

      fireEvent.click(editButtons[1]!);

      expect(await screen.findByText("Edit Leave Request")).toBeInTheDocument();

      const reasonInput = screen.getByPlaceholderText("Employee leave reason...");
      fireEvent.change(reasonInput, { target: { value: "Updated medical reason" } });

      const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith(
          "edit_leave_request_transactional",
          expect.objectContaining({
            p_request_id: "req-approved",
            p_leave_type_id: "lt-sl",
            p_from_date: "2026-11-10",
            p_to_date: "2026-11-10",
            p_days: 1,
            p_reason: "Updated medical reason",
            p_status: "approved",
            p_current_approval_level: "completed",
          })
        );
      });
    },
    15000
  );

  it("hides HR/Admin all-leaves edit controls from non-HR reporting managers", async () => {
    renderWithQuery(
      <LeaveApprovalsManager
        currentEmployeeId="emp-mgr"
        isAdmin={false}
        isManager={true}
        isHrOrAdmin={false}
      />
    );

    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All Leaves" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
  });

  it("migration 20261126140000 defines HR/Admin RPCs without writing generated remaining column", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20261126140000_hr_admin_edit_leave_all_levels.sql"),
      "utf8"
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_hr_or_admin(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.edit_leave_request_transactional(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_adjust_leave_balance(");
    expect(sql).toContain("app.leave_tx_handled");
    expect(sql).not.toMatch(/UPDATE\s+public\.leave_balances[\s\S]*?\bremaining\s*=/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.leave_requests[\s\S]*?\bupdated_at\s*=/i);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.block_overlapping_leave()");
  });

  it("allows HR/Admin to edit employee leave balance days via EditLeaveBalanceDialog", async () => {
    const onOpenChange = vi.fn();
    renderWithQuery(
      <EditLeaveBalanceDialog
        target={{
          employeeId: "emp-2",
          employeeName: "Asha Rao",
          leaveTypeId: "lt-cl",
          leaveTypeName: "Casual Leave",
          year: 2026,
          total: 12,
          used: 2,
          carriedForward: 1,
        }}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText(/Edit Casual Leave Days/i)).toBeInTheDocument();
    expect(screen.getByText("10 days")).toBeInTheDocument();

    const totalInput = screen.getByLabelText(/Total Days/i);
    fireEvent.change(totalInput, { target: { value: "18.5" } });
    expect(screen.getByText("16.5 days")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Leave Days/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("admin_adjust_leave_balance", {
        p_employee_id: "emp-2",
        p_leave_type_id: "lt-cl",
        p_year: 2026,
        p_total: 18.5,
        p_used: 2,
        p_carried_forward: 1,
      });
    });
  });
});
