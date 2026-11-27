import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  Settings2,
  Users,
  Eye,
  Plus,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import {
  PayrollRun,
  PayslipItem,
  EmployeeSalaryStructure,
  PayrollSettings,
  formatINR,
} from "@/lib/payroll";
import { ProcessPayrollDialog } from "./ProcessPayrollDialog";
import { SalaryStructureModal } from "./SalaryStructureModal";
import { PayslipViewDialog } from "./PayslipViewDialog";
import { PayrollReports } from "./PayrollReports";
import { EditPaymentDialog, type EditablePayrollEmployee } from "./EditPaymentDialog";
import { toast } from "sonner";

interface PayrollOrgEmployee {
  id: string;
  full_name: string;
  employee_code: string;
  email: string;
  designation: string | null;
  joining_date: string | null;
  status: string | null;
  department: { name: string } | null;
}

interface PayrollDashboardProps {
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  isManager: boolean;
}

export function PayrollDashboard({
  organizationId,
  userId,
  isAdmin,
  isManager,
}: PayrollDashboardProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("runs");
  const [isProcessOpen, setIsProcessOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<EmployeeSalaryStructure | null>(null);
  const [selectedStructureEmp, setSelectedStructureEmp] = useState<PayrollOrgEmployee | null>(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [editingPaymentTarget, setEditingPaymentTarget] = useState<{
    employee: EditablePayrollEmployee;
    payslip: PayslipItem | null;
    structure: EmployeeSalaryStructure | null;
  } | null>(null);

  // 1. Fetch Payroll Runs
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["payroll-runs", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollRun[];
    },
    enabled: !!organizationId,
  });

  // Default select the latest run
  const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0] || null;

  // 2. Fetch Payslips for active run
  const { data: runPayslips = [], isLoading: payslipsLoading } = useQuery({
    queryKey: ["payroll-run-payslips", activeRun?.id],
    queryFn: async () => {
      if (!activeRun?.id) return [];
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          *,
          employee:employees!payslips_employee_id_fkey(
            id,
            full_name,
            employee_code,
            designation,
            joining_date,
            department:departments(name)
          )
        `)
        .eq("payroll_run_id", activeRun.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as PayslipItem[];
    },
    enabled: !!activeRun?.id,
  });

  // 3. Fetch Salary Structures for all employees
  const { data: structures = [], isLoading: structLoading } = useQuery({
    queryKey: ["salary-structures", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salary_structures")
        .select(`
          *,
          employee:employees!employee_salary_structures_employee_id_fkey(
            id,
            full_name,
            employee_code,
            email,
            designation,
            department:departments(name)
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as EmployeeSalaryStructure[];
    },
    enabled: !!organizationId,
  });

  // 3b. Fetch all active employees so every employee is always listed & editable
  const { data: orgEmployees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["payroll-org-employees", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code, email, designation, joining_date, status, department:departments(name)",
        )
        .eq("organization_id", organizationId)
        .neq("is_superadmin", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown as PayrollOrgEmployee[]).filter(
        (e) => e.status !== "relieved" && e.status !== "terminated",
      );
    },
    enabled: !!organizationId,
  });

  // 4. Fetch Payroll Settings
  const { data: settings } = useQuery({
    queryKey: ["payroll-settings", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as PayrollSettings | null;
    },
    enabled: !!organizationId,
  });

  // Merge active employees with salary structures & run payslips so every employee appears
  const structureByEmpId = useMemo(() => {
    const map = new Map<string, EmployeeSalaryStructure>();
    for (const s of structures) {
      if (!map.has(s.employee_id) || s.is_active) {
        map.set(s.employee_id, s);
      }
    }
    return map;
  }, [structures]);

  const employeeRunRows = useMemo(() => {
    const byEmp = new Map<string, PayslipItem>();
    for (const p of runPayslips) {
      byEmp.set(p.employee_id, p);
    }

    const rows: Array<{
      employee: PayrollOrgEmployee;
      payslip: PayslipItem | null;
      structure: EmployeeSalaryStructure | null;
    }> = orgEmployees.map((emp) => ({
      employee: emp,
      payslip: byEmp.get(emp.id) ?? null,
      structure: structureByEmpId.get(emp.id) ?? null,
    }));

    const seenIds = new Set(orgEmployees.map((e) => e.id));
    for (const p of runPayslips) {
      if (!seenIds.has(p.employee_id) && p.employee) {
        rows.push({
          employee: {
            id: p.employee.id,
            full_name: p.employee.full_name,
            employee_code: p.employee.employee_code,
            email: p.employee.email || "",
            designation: p.employee.designation ?? null,
            joining_date: p.employee.joining_date ?? null,
            status: null,
            department: p.employee.department ? { name: p.employee.department.name } : null,
          },
          payslip: p,
          structure: structureByEmpId.get(p.employee_id) ?? null,
        });
      }
    }
    return rows;
  }, [orgEmployees, runPayslips, structureByEmpId]);

  const canEditRunPayments =
    isAdmin && Boolean(activeRun) && activeRun?.status !== "locked" && activeRun?.status !== "paid";

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.rpc("approve_payroll_run", {
        _payroll_run_id: runId,
        _user_id: userId,
        _notes: "Approved by HR Administrator",
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.error || "Approval failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-payslips"] });
      toast.success("Payroll batch approved successfully.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve payroll run.");
    },
  });

  // Lock Mutation
  const lockMutation = useMutation({
    mutationFn: async (runId: string) => {
      const ref = `SAL-${activeRun?.year}-${activeRun?.month}-${Math.floor(1000 + Math.random() * 9000)}`;
      const paymentDate = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("lock_payroll_run", {
        _payroll_run_id: runId,
        _user_id: userId,
        _payment_date: paymentDate,
        _payment_ref: ref,
        _notes: "Finalized, locked and published to self-service portal.",
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.error || "Locking failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-payslips"] });
      toast.success("Payroll locked and payslips published to employees.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to lock payroll run.");
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Indian Payroll Management
          </h2>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsProcessOpen(true)}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="h-4 w-4" /> Process Monthly Payroll
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="runs" className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Payroll Runs & Batches
          </TabsTrigger>
          <TabsTrigger value="structures" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> Salary Structures ({orgEmployees.length || structures.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 text-xs">
            <Calculator className="h-3.5 w-3.5" /> Payroll Reports & Register
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 text-xs">
            <Settings2 className="h-3.5 w-3.5" /> Statutory Rules
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Runs & Batches */}
        <TabsContent value="runs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Run Selector Sidebar */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Monthly Batches
              </h3>
              {runsLoading ? (
                <div className="text-xs text-muted-foreground p-4">Loading runs...</div>
              ) : runs.length === 0 ? (
                <div className="p-4 rounded-lg border bg-card text-center text-xs text-muted-foreground">
                  No payroll runs yet. Click "Process Monthly Payroll" to start.
                </div>
              ) : (
                <div className="space-y-2">
                  {runs.map((r) => {
                    const isSelected = activeRun?.id === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRunId(r.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary text-foreground shadow-sm"
                            : "bg-card hover:bg-muted/40 border-border text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-foreground">
                            {r.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              r.status === "locked" || r.status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                                : r.status === "approved"
                                ? "bg-blue-500/10 text-blue-600 border-blue-300"
                                : "bg-amber-500/10 text-amber-600 border-amber-300"
                            }`}
                          >
                            {r.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span>{r.total_employees} Employees</span>
                          <span className="font-semibold text-foreground">
                            {formatINR(r.total_net)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Run Details & Payslips Table */}
            <div className="lg:col-span-3 space-y-4">
              {activeRun ? (
                <>
                  {/* Run Header Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {activeRun.title}
                            <Badge
                              variant="outline"
                              className={
                                activeRun.status === "locked"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                                  : "bg-amber-500/10 text-amber-600 border-amber-300"
                              }
                            >
                              {activeRun.status.toUpperCase()}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Total Gross: {formatINR(activeRun.total_gross)} | Net Payout:{" "}
                            <span className="font-bold text-foreground">
                              {formatINR(activeRun.total_net)}
                            </span>
                          </CardDescription>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            {activeRun.status === "draft" || activeRun.status === "in_review" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMutation.mutate(activeRun.id)}
                                disabled={approveMutation.isPending}
                                className="text-xs gap-1.5 text-blue-600"
                              >
                                <CheckCircle2 className="h-4 w-4" /> Approve Batch
                              </Button>
                            ) : null}

                            {activeRun.status === "approved" ? (
                              <Button
                                size="sm"
                                onClick={() => lockMutation.mutate(activeRun.id)}
                                disabled={lockMutation.isPending}
                                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Lock className="h-4 w-4" /> Lock & Publish Payslips
                              </Button>
                            ) : null}

                            {activeRun.status === "locked" ? (
                              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                                <Lock className="h-3 w-3" /> Locked & Finalized
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-3 rounded-lg border">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Employees</span>
                          <span className="font-semibold text-foreground">{activeRun.total_employees}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">EPF Remittance</span>
                          <span className="font-semibold text-indigo-600">
                            {formatINR(activeRun.total_pf_employee + activeRun.total_pf_employer)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">State PT</span>
                          <span className="font-semibold text-foreground">{formatINR(activeRun.total_pt)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">LOP Deductions</span>
                          <span className="font-semibold text-rose-600">
                            {formatINR(activeRun.total_lop_deductions)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Line Item Payslips Table */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold">
                          Employee Payroll & Payments ({employeeRunRows.length})
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {payslipsLoading || employeesLoading ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">Loading employee payroll...</div>
                      ) : employeeRunRows.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">No active employees found in organization.</div>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-muted/40 border-b">
                                <th className="p-2.5 font-semibold">Employee</th>
                                <th className="p-2.5 font-semibold text-right">Gross (₹)</th>
                                <th className="p-2.5 font-semibold text-right">EPF (₹)</th>
                                <th className="p-2.5 font-semibold text-right">PT (₹)</th>
                                <th className="p-2.5 font-semibold text-right">LOP (₹)</th>
                                <th className="p-2.5 font-semibold text-right">Net Take-Home</th>
                                <th className="p-2.5 font-semibold text-center">Status</th>
                                <th className="p-2.5 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {employeeRunRows.map(({ employee: emp, payslip: p, structure: s }) => (
                                <tr key={emp.id} className="hover:bg-muted/10">
                                  <td className="p-2.5">
                                    <div className="font-semibold text-foreground">{emp.full_name}</div>
                                    <div className="text-[11px] text-muted-foreground font-mono">{emp.employee_code}</div>
                                  </td>
                                  <td className="p-2.5 text-right">{p ? formatINR(p.gross_salary) : "—"}</td>
                                  <td className="p-2.5 text-right text-amber-600">{p ? formatINR(p.pf_employee) : "—"}</td>
                                  <td className="p-2.5 text-right text-amber-600">{p ? formatINR(p.professional_tax) : "—"}</td>
                                  <td className="p-2.5 text-right text-rose-600">{p ? formatINR(p.lop_deduction) : "—"}</td>
                                  <td className="p-2.5 text-right font-bold text-emerald-600">
                                    {p ? formatINR(p.net_salary) : "Not calculated"}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <Badge variant="outline" className="text-[10px]">
                                      {p ? p.status : "unprocessed"}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {canEditRunPayments && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setEditingPaymentTarget({
                                              employee: emp,
                                              payslip: p,
                                              structure: s,
                                            })
                                          }
                                          className="h-7 text-xs gap-1"
                                        >
                                          <Pencil className="h-3 w-3" /> {p ? "Edit Payment" : "Set Payment"}
                                        </Button>
                                      )}
                                      {p && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSelectedPayslip(p);
                                            setIsPayslipOpen(true);
                                          }}
                                          className="h-7 text-xs gap-1"
                                        >
                                          <Eye className="h-3.5 w-3.5" /> View / PDF
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="p-12 text-center text-xs text-muted-foreground border rounded-lg">
                  Select a payroll batch or run a new calculation to view payslip statements.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Salary Structures */}
        <TabsContent value="structures" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Employee Salary Structures
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {structLoading || employeesLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading employees & salary structures...</div>
              ) : orgEmployees.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No active employees found.</div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2.5 font-semibold">Employee</th>
                        <th className="p-2.5 font-semibold">Department</th>
                        <th className="p-2.5 font-semibold text-right">Annual CTC (₹)</th>
                        <th className="p-2.5 font-semibold text-right">Basic (₹)</th>
                        <th className="p-2.5 font-semibold text-right">HRA (₹)</th>
                        <th className="p-2.5 font-semibold text-center">EPF</th>
                        <th className="p-2.5 font-semibold text-center">ESI</th>
                        <th className="p-2.5 font-semibold">PT State</th>
                        <th className="p-2.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orgEmployees.map((emp) => {
                        const s = structureByEmpId.get(emp.id) ?? null;
                        return (
                          <tr key={emp.id} className="hover:bg-muted/10">
                            <td className="p-2.5">
                              <div className="font-semibold text-foreground">{emp.full_name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{emp.employee_code}</div>
                            </td>
                            <td className="p-2.5 text-muted-foreground">{emp.department?.name || "General"}</td>
                            <td className="p-2.5 text-right font-semibold">
                              {s ? formatINR(s.ctc_annual) : <span className="text-muted-foreground font-normal">Default</span>}
                            </td>
                            <td className="p-2.5 text-right">{s ? formatINR(s.basic_salary) : "—"}</td>
                            <td className="p-2.5 text-right">{s ? formatINR(s.hra) : "—"}</td>
                            <td className="p-2.5 text-center">
                              <Badge variant="outline" className={`text-[10px] ${!s || s.pf_applicable ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {!s || s.pf_applicable ? "12%" : "No"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge variant="outline" className={`text-[10px] ${s?.esi_applicable ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {s?.esi_applicable ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="p-2.5 font-medium">{s?.pt_state || "Default"}</td>
                            <td className="p-2.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedStructure(s);
                                  setSelectedStructureEmp(emp);
                                  setIsStructureModalOpen(true);
                                }}
                                className="h-7 text-xs"
                              >
                                {s ? "Edit Salary" : "Configure"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Reports & Register */}
        <TabsContent value="reports" className="space-y-4">
          <PayrollReports organizationId={organizationId} />
        </TabsContent>

        {/* Tab 4: Statutory Settings */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Indian Statutory Compliance Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-primary" /> Employees Provident Fund (EPF)
                  </h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between"><span>Employee Contribution:</span> <span className="font-semibold text-foreground">12.00%</span></div>
                    <div className="flex justify-between"><span>Employer Contribution:</span> <span className="font-semibold text-foreground">12.00%</span></div>
                    <div className="flex justify-between"><span>Statutory Wage Ceiling:</span> <span className="font-semibold text-foreground">₹15,000 / month</span></div>
                    <div className="flex justify-between"><span>Maximum Monthly Cap:</span> <span className="font-semibold text-foreground">₹1,800 / month</span></div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-primary" /> Employee State Insurance (ESI)
                  </h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between"><span>Employee Contribution:</span> <span className="font-semibold text-foreground">0.75%</span></div>
                    <div className="flex justify-between"><span>Employer Contribution:</span> <span className="font-semibold text-foreground">3.25%</span></div>
                    <div className="flex justify-between"><span>Gross Salary Eligibility Ceiling:</span> <span className="font-semibold text-foreground">₹21,000 / month</span></div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
                  <h4 className="font-bold text-foreground">Professional Tax (PT) Slabs</h4>
                  <p className="text-muted-foreground text-[11px]">
                    Standard state government brackets applied automatically:
                  </p>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Karnataka (Gross ≥ ₹15,000):</span> <span className="font-semibold text-foreground">₹200 / month</span></div>
                    <div className="flex justify-between"><span>Maharashtra (Gross &gt; ₹10,000):</span> <span className="font-semibold text-foreground">₹200 / month</span></div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
                  <h4 className="font-bold text-foreground">Attendance & LOP Calculation</h4>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Working Days Basis:</span> <span className="font-semibold text-foreground">Calendar Days in Month</span></div>
                    <div className="flex justify-between"><span>Overtime Multiplier:</span> <span className="font-semibold text-foreground">1.5x Hourly Rate</span></div>
                    <div className="flex justify-between"><span>Loss of Pay (LOP) Rule:</span> <span className="font-semibold text-foreground">(Monthly Gross / Days) × Unpaid Days</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProcessPayrollDialog
        open={isProcessOpen}
        onOpenChange={setIsProcessOpen}
        organizationId={organizationId}
        userId={userId}
        onSuccessRun={(runId) => setSelectedRunId(runId)}
      />

      <SalaryStructureModal
        open={isStructureModalOpen}
        onOpenChange={(open) => {
          setIsStructureModalOpen(open);
          if (!open) setSelectedStructureEmp(null);
        }}
        structure={selectedStructure}
        employeeId={selectedStructureEmp?.id}
        employeeName={selectedStructureEmp?.full_name}
        organizationId={organizationId}
      />

      <EditPaymentDialog
        open={Boolean(editingPaymentTarget)}
        onOpenChange={(open) => {
          if (!open) setEditingPaymentTarget(null);
        }}
        payrollRunId={activeRun?.id ?? null}
        runTitle={activeRun?.title ?? "Monthly Payroll"}
        employee={editingPaymentTarget?.employee ?? null}
        payslip={editingPaymentTarget?.payslip ?? null}
        structure={editingPaymentTarget?.structure ?? null}
      />

      <PayslipViewDialog
        open={isPayslipOpen}
        onOpenChange={setIsPayslipOpen}
        payslip={selectedPayslip}
      />
    </div>
  );
}
