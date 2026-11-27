import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

let mockSessionState = {
  session: null,
  user: { id: "user-root", email: "root@example.com" },
  organizationId: "org-1",
  organizationName: "Fluxora Technologies",
  orgRole: "super_admin",
  workLocationId: null,
  roles: ["admin"],
  fullName: "Root Operator",
  departmentId: null,
  departmentName: "Executive",
  department: "Executive",
  employeeId: "emp-root",
  employeeCode: "ROOT001",
  designation: "Root Super Administrator",
  isSuperadmin: true,
  loading: false,
  isAdmin: true,
  isManager: false,
  isEmployee: false,
  isStaff: true,
  isKiosk: false,
  hasAccess: true,
};

const mockRpc = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: any) => (
      <a href={typeof to === "string" ? to : "#"} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/hooks/use-session", () => ({
  useSession: () => mockSessionState,
}));

vi.mock("@/components/geofence-attendance-card", () => ({
  GeofenceAttendanceCard: () => <div data-testid="geofence-card" />,
}));

vi.mock("@/integrations/supabase/client", () => {
  const emptyChain: any = {
    select: () => emptyChain,
    eq: () => emptyChain,
    neq: () => emptyChain,
    gte: () => emptyChain,
    lte: () => emptyChain,
    or: () => emptyChain,
    in: () => emptyChain,
    not: () => emptyChain,
    order: () => emptyChain,
    limit: () => emptyChain,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (val: any) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
  };

  return {
    supabase: {
      rpc: (...args: unknown[]) => mockRpc(...args),
      channel: () => ({
        on: function () {
          return this;
        },
        subscribe: () => ({}),
      }),
      getChannels: () => [],
      removeChannel: () => {},
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signInWithPassword: vi.fn(),
      },
      from: (table: string) => {
        if (table === "employees") {
          const employeesRows = [
            {
              id: "emp-hr",
              user_id: "user-hr",
              full_name: "Priya HR",
              email: "priya.hr@example.com",
              employee_code: "HR001",
              designation: "HR Administrator",
              department_id: "dept-1",
              is_superadmin: false,
              departments: { name: "Human Resources" },
            },
            {
              id: "emp-dev",
              user_id: "user-dev",
              full_name: "Rohan Verma",
              email: "rohan@example.com",
              employee_code: "EMP102",
              designation: "Software Engineer",
              department_id: "dept-2",
              is_superadmin: false,
              departments: { name: "Engineering" },
            },
          ];
          const empChain: any = {
            select: () => empChain,
            eq: () => empChain,
            neq: () => empChain,
            order: async () => ({ data: employeesRows, error: null }),
          };
          return empChain;
        }
        if (table === "user_roles") {
          return {
            select: async () => ({
              data: [
                { user_id: "user-hr", role: "admin" },
                { user_id: "user-dev", role: "employee" },
              ],
              error: null,
            }),
          };
        }
        return emptyChain;
      },
    },
  };
});

import { Route as SuperadminRoute } from "@/routes/_authenticated/superadmin";
import { Route as DashboardRoute } from "@/routes/_authenticated/dashboard";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Superadmin Theme Toggle & HR Role Selection Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    localStorage.clear();
    sessionStorage.clear();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("synchronizes multiple ThemeToggle buttons between Light and Dark mode", async () => {
    render(
      <div>
        <ThemeToggle showLabel />
        <ThemeToggle showLabel />
      </div>,
    );

    const buttons = screen.getAllByRole("button", { name: /Toggle dark mode/i });
    expect(buttons).toHaveLength(2);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(buttons[0]!);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem("fta-theme")).toBe("dark");
      expect(screen.getAllByText(/Dark Mode/i)).toHaveLength(2);
    });

    fireEvent.click(buttons[1]!);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem("fta-theme")).toBe("light");
      expect(screen.getAllByText(/Light Mode/i)).toHaveLength(2);
    });
  });

  it("renders Dark/Light mode toggle in unlocked Superadmin console", async () => {
    mockSessionState = {
      ...mockSessionState,
      isSuperadmin: true,
      isAdmin: true,
      orgRole: "super_admin",
    };
    sessionStorage.setItem("superadmin_unlocked", "true");

    const SuperadminComponent = SuperadminRoute.options.component!;
    renderWithQuery(<SuperadminComponent />);

    await waitFor(() => {
      expect(screen.getByText(/System Administration/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Toggle dark mode/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.getByText(/HR Admins/i)).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("lets HR Admin manage Employee and Manager roles directly on HR Dashboard", async () => {
    mockSessionState = {
      ...mockSessionState,
      user: { id: "user-hr", email: "priya.hr@example.com" },
      fullName: "Priya HR",
      isSuperadmin: false,
      isAdmin: true,
      isManager: false,
      isEmployee: false,
      orgRole: "org_admin",
    };

    const DashboardComponent = DashboardRoute.options.component!;
    renderWithQuery(<DashboardComponent />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /HR Dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/Team Access & Role Management/i)).toBeInTheDocument();
      expect(screen.getByText("Rohan Verma")).toBeInTheDocument();
    });

    // HR Admin (self / admin) should not show in Employee/Manager switcher list
    expect(screen.queryByLabelText(/Select role for Priya HR/i)).not.toBeInTheDocument();

    // Open Registration Modal directly from HR Dashboard
    fireEvent.click(screen.getAllByRole("button", { name: /Add Employee \/ Manager/i })[0]!);
    await waitFor(() => {
      expect(screen.getByText(/Register New Employee/i)).toBeInTheDocument();
    });
  });
});
