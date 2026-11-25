import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Eye,
  DollarSign,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { EmployeeExit, EXIT_STATUS_CONFIG } from "@/lib/offboarding";
import { ExitDetailDrawer } from "./ExitDetailDrawer";
import { ResignationModal } from "./ResignationModal";

interface OffboardingDashboardProps {
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  isManager: boolean;
}

export function OffboardingDashboard({
  organizationId,
  userId,
  isAdmin,
  isManager,
}: OffboardingDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedExit, setSelectedExit] = useState<EmployeeExit | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);

  // Fetch active exits
  const { data: exits = [], isLoading } = useQuery({
    queryKey: ["employee-exits", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exits")
        .select(`
          *,
          employee:employees!employee_exits_employee_id_fkey(
            id,
            full_name,
            employee_code,
            email,
            designation,
            joining_date,
            department:departments(name)
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any) as EmployeeExit[];
    },
    enabled: !!organizationId,
  });

  // Fetch all employees for resignation picker
  const { data: employees = [] } = useQuery({
    queryKey: ["org-employees-for-exit", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation")
        .eq("organization_id", organizationId)
        .neq("status", "relieved");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isAdmin,
  });

  const [selectedEmpIdForExit, setSelectedEmpIdForExit] = useState<string>("");

  // Filtered Exits
  const filteredExits = exits.filter((e) => {
    const matchesSearch =
      (e.employee?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.employee?.employee_code || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregates
  const totalExits = exits.length;
  const inClearance = exits.filter((e) => e.status === "in_clearance").length;
  const pendingFnF = exits.filter((e) => e.fnf_status === "pending" || e.status === "clearance_completed").length;
  const relieved = exits.filter((e) => e.status === "relieved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LogOut className="h-6 w-6 text-rose-500" /> Employee Offboarding & Exit Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Orchestrate resignation submissions, notice periods, 4-way department clearances, KT handovers, asset returns, and Full & Final settlement.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                const firstEmp = employees[0];
                if (firstEmp) {
                  setSelectedEmpIdForExit(firstEmp.id);
                  setIsResignModalOpen(true);
                }
              }}
              className="gap-1.5 text-xs shadow-sm bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Plus className="h-4 w-4" /> Initiate Separation
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Total Separations</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">{totalExits}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All registered offboarding records
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">In Clearance</CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600">{inClearance}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            KT & Asset return in progress
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Pending FnF Settlement</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">{pendingFnF}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Clearance done; awaiting payout
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold">Relieved & Closed</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">{relieved}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Certificates issued; record preserved
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            <SelectItem value="submitted" className="text-xs">Submitted</SelectItem>
            <SelectItem value="in_clearance" className="text-xs">In Clearance</SelectItem>
            <SelectItem value="clearance_completed" className="text-xs">Clearance Completed</SelectItem>
            <SelectItem value="fnf_settled" className="text-xs">FnF Settled</SelectItem>
            <SelectItem value="relieved" className="text-xs">Relieved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Active Offboarding Pipeline ({filteredExits.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Inspect separation progress, notice period tracking, and department sign-offs.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading separation records...</div>
          ) : filteredExits.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No offboarding records found matching your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="p-2.5 font-semibold">Employee</th>
                    <th className="p-2.5 font-semibold">Department</th>
                    <th className="p-2.5 font-semibold">Resignation Date</th>
                    <th className="p-2.5 font-semibold">Agreed LWD</th>
                    <th className="p-2.5 font-semibold">Notice</th>
                    <th className="p-2.5 font-semibold text-center">Clearance</th>
                    <th className="p-2.5 font-semibold text-center">Status</th>
                    <th className="p-2.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredExits.map((ex) => {
                    const st = EXIT_STATUS_CONFIG[ex.status] || EXIT_STATUS_CONFIG.submitted;
                    return (
                      <tr key={ex.id} className="hover:bg-muted/10">
                        <td className="p-2.5">
                          <div className="font-semibold text-foreground">{ex.employee?.full_name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{ex.employee?.employee_code}</div>
                        </td>
                        <td className="p-2.5 text-muted-foreground">{ex.employee?.department?.name || "General"}</td>
                        <td className="p-2.5">{ex.resignation_date}</td>
                        <td className="p-2.5 font-semibold text-foreground">{ex.agreed_last_working_day}</td>
                        <td className="p-2.5">{ex.notice_period_days} Days</td>
                        <td className="p-2.5 text-center">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {ex.clearance_status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge variant="outline" className={`text-[10px] ${st.badgeClass}`}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedExit(ex);
                              setIsDrawerOpen(true);
                            }}
                            className="h-7 text-xs gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> Manage Exit
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

      {/* Drawer */}
      <ExitDetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        exit={selectedExit}
        userId={userId}
        isAdmin={isAdmin}
        isManager={isManager}
      />

      {/* Resignation Initiator Modal */}
      {selectedEmpIdForExit && (
        <ResignationModal
          open={isResignModalOpen}
          onOpenChange={setIsResignModalOpen}
          employeeId={selectedEmpIdForExit}
          employeeName={employees.find((e) => e.id === selectedEmpIdForExit)?.full_name}
        />
      )}
    </div>
  );
}
