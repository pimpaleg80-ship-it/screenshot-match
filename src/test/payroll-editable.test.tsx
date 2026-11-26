import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayrollDashboard } from "../components/payroll/PayrollDashboard";

const mockRpc = vi.fn();
let runStatus = "in_review";

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table === "payroll_runs") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      id: "run-1",
                      organization_id: "org-1",
                      month: 11,
                      year: 2026,
                      title: "Payroll - November 2026",
                      status: runStatus,
                      total_employees: 1,
                      total_gross: 50000,
                      total_deductions: 2000,
                      total_net: 48000,
                      total_pf_employee: 1800,
                      total_pf_employer: 1800,
                      total_esi_employee: 0,
                      total_esi_employer: 0,
                      total_pt: 200,
                      total_tds: 0,
                      total_lop_deductions: 0,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "payslips") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: "slip-1",
                    employee_id: "emp-1",
                    payroll_run_id: "run-1",
                    month: 11,
                    year: 2026,
                    basic_salary: 25000,
                    hra: 12500,
                    special_allowance: 9500,
                    conveyance_allowance: 1500,
                    medical_allowance: 1500,
                    other_allowances: 0,
                    allowances: 25000,
                    bonus: 0,
                    overtime_hours: 0,
                    overtime_pay: 0,
                    gross_salary: 50000,
                    pf_employee: 1800,
                    pf_employer: 1800,
                    esi_employee: 0,
                    esi_employer: 0,
                    professional_tax: 200,
                    tds: 0,
                    lop_days: 0,
                    lop_deduction: 0,
                    other_deductions: 0,
                    deductions: 2000,
                    total_deductions: 2000,
                    net_salary: 48000,
                    working_days: 30,
                    present_days: 30,
                    leave_days: 0,
                    status: "draft",
                    payment_method: "bank_transfer",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "employees") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: "emp-1",
                    full_name: "Ada Lovelace",
                    employee_code: "EMP001",
                    email: "ada@example.com",
                    designation: "Engineer",
                    joining_date: "2026-01-01",
                    status: "active",
                    department: { name: "Engineering" },
                  },
                  {
                    id: "emp-2",
                    full_name: "Grace Hopper",
                    employee_code: "EMP002",
                    email: "grace@example.com",
                    designation: "Architect",
                    joining_date: "2026-02-01",
                    status: "active",
                    department: { name: "Engineering" },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "employee_salary_structures") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  },
}));

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PayrollDashboard organizationId="org-1" userId="user-1" isAdmin={true} isManager={true} />
    </QueryClientProvider>,
  );
}

describe("Editable Per-Employee Payroll Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runStatus = "in_review";
    mockRpc.mockResolvedValue({ data: { success: true, payslip_id: "slip-2", net_salary: 48000 }, error: null });
  });

  it("lists every active employee and allows editing monthly payments in unlocked payroll runs", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Edit Payment/i })).toBeEnabled();
    const setBtn = screen.getByRole("button", { name: /Set Payment/i });
    expect(setBtn).toBeEnabled();

    fireEvent.click(setBtn);
    await waitFor(() => {
      expect(screen.getByText(/Edit Payment — Grace Hopper/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Payment/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "update_employee_payslip",
        expect.objectContaining({
          _payroll_run_id: "run-1",
          _employee_id: "emp-2",
        }),
      );
    });
  }, 15000);

  it("hides payment edit buttons once the payroll batch is locked", async () => {
    runStatus = "locked";
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Edit Payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set Payment/i })).not.toBeInTheDocument();
  });
});
