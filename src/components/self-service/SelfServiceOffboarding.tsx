import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  Laptop,
  CheckSquare,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import {
  EmployeeExit,
  EXIT_STATUS_CONFIG,
  generateRelievingLetterPDF,
  generateExperienceCertificatePDF,
} from "@/lib/offboarding";
import { ResignationModal } from "@/components/offboarding/ResignationModal";

interface SelfServiceOffboardingProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  joiningDate?: string | null | undefined;
  designation?: string | null | undefined;
  departmentName?: string | null | undefined;
  noticePeriodDays?: number | undefined;
}

export function SelfServiceOffboarding({
  employeeId,
  employeeName,
  employeeCode,
  joiningDate,
  designation,
  departmentName,
  noticePeriodDays = 30,
}: SelfServiceOffboardingProps) {
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);

  // Fetch my active exit record
  const { data: myExit, isLoading } = useQuery({
    queryKey: ["my-exit-record", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exits")
        .select(`
          *,
          employee:employees!employee_exits_employee_id_fkey(
            id, full_name, employee_code, designation, joining_date, department:departments(name)
          )
        `)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as EmployeeExit | null;
    },
    enabled: !!employeeId,
  });

  // Fetch KT tasks for my exit
  const { data: ktTasks = [] } = useQuery({
    queryKey: ["my-exit-kt-tasks", myExit?.id],
    queryFn: async () => {
      if (!myExit?.id) return [];
      const { data, error } = await supabase
        .from("exit_kt_tasks")
        .select("*")
        .eq("exit_id", myExit.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!myExit?.id,
  });

  // Fetch Asset returns
  const { data: assets = [] } = useQuery({
    queryKey: ["my-exit-assets", myExit?.id],
    queryFn: async () => {
      if (!myExit?.id) return [];
      const { data, error } = await supabase
        .from("exit_asset_returns")
        .select("*")
        .eq("exit_id", myExit.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!myExit?.id,
  });

  // Fetch clearances
  const { data: clearances = [] } = useQuery({
    queryKey: ["my-exit-clearances", myExit?.id],
    queryFn: async () => {
      if (!myExit?.id) return [];
      const { data, error } = await supabase
        .from("exit_clearances")
        .select("*")
        .eq("exit_id", myExit.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!myExit?.id,
  });

  function downloadRelieving() {
    if (!myExit) return;
    const doc = generateRelievingLetterPDF({
      employee: {
        full_name: employeeName,
        employee_code: employeeCode,
        designation,
        department_name: departmentName,
        joining_date: joiningDate,
      },
      exit: myExit,
    });
    doc.save(`Relieving_Letter_${employeeCode}.pdf`);
  }

  function downloadExperience() {
    if (!myExit) return;
    const doc = generateExperienceCertificatePDF({
      employee: {
        full_name: employeeName,
        employee_code: employeeCode,
        designation,
        department_name: departmentName,
        joining_date: joiningDate,
      },
      exit: myExit,
    });
    doc.save(`Experience_Certificate_${employeeCode}.pdf`);
  }

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading separation status...</div>;
  }

  if (!myExit) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-primary" /> Separation & Resignation Portal
                </CardTitle>
                <CardDescription className="text-xs">
                  Review separation policies, notice period obligations, and initiate resignation.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-300">
                Active Employee
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/20 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Notice Period Policy</span>
                <span className="font-semibold text-foreground">{noticePeriodDays} Calendar Days</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Employment Type</span>
                <span className="font-semibold text-foreground">Regular Full-Time</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Separation Status</span>
                <span className="font-semibold text-foreground">In Good Standing</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card space-y-3">
              <h4 className="font-bold text-xs">Initiating Voluntary Resignation</h4>
              <p className="text-xs text-muted-foreground">
                Submitting a formal resignation will notify your reporting manager and the People Operations team.
                The standard transition timeline involves knowledge transfer sessions, returning allocated hardware and access badges, and concluding department clearances.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResignModalOpen(true)}
                className="text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <LogOut className="h-4 w-4" /> Submit Resignation Request
              </Button>
            </div>
          </CardContent>
        </Card>

        <ResignationModal
          open={isResignModalOpen}
          onOpenChange={setIsResignModalOpen}
          employeeId={employeeId}
          employeeName={employeeName}
          defaultNoticeDays={noticePeriodDays}
        />
      </div>
    );
  }

  const st = EXIT_STATUS_CONFIG[myExit.status] || EXIT_STATUS_CONFIG.submitted;

  return (
    <div className="space-y-6">
      {/* Active Exit Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LogOut className="h-4 w-4 text-primary" /> Active Separation Journey
                <Badge variant="outline" className={`text-xs ${st.badgeClass}`}>
                  {st.label}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Requested Last Working Day: <span className="font-semibold text-foreground">{myExit.requested_last_working_day}</span> •
                Agreed LWD: <span className="font-semibold text-emerald-600">{myExit.agreed_last_working_day}</span>
              </CardDescription>
            </div>

            {myExit.status === "relieved" && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={downloadRelieving} className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Relieving Letter
                </Button>
                <Button size="sm" variant="outline" onClick={downloadExperience} className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Experience Certificate
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Stepper */}
          <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-semibold pt-1">
            {[
              { label: "Submitted", step: 1 },
              { label: "Approved", step: 2 },
              { label: "Clearance", step: 3 },
              { label: "Cleared", step: 4 },
              { label: "FnF Settled", step: 5 },
              { label: "Relieved", step: 6 },
            ].map((s) => {
              const isPastOrCurrent = (st.step || 0) >= s.step;
              return (
                <div key={s.step} className="flex flex-col items-center">
                  <div
                    className={`h-2 w-full rounded-full mb-1 transition-all ${
                      isPastOrCurrent ? "bg-primary" : "bg-muted"
                    }`}
                  />
                  <span className={isPastOrCurrent ? "text-foreground" : "text-muted-foreground"}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Department Clearances Status Grid */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Four-Way Clearances Tracking
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {clearances.map((c) => (
                <div key={c.id} className="p-3 rounded-lg border bg-muted/20 flex flex-col justify-between">
                  <span className="font-semibold text-foreground text-[11px]">{c.department_type}</span>
                  <Badge
                    variant="outline"
                    className={`mt-2 w-max text-[10px] ${
                      c.status === "cleared"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                        : "bg-amber-500/10 text-amber-600 border-amber-300"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* KT and Assets overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* KT Tasks */}
            <div className="border rounded-lg p-4 space-y-2">
              <h5 className="font-bold flex items-center gap-1.5 text-foreground">
                <CheckSquare className="h-4 w-4 text-primary" /> Knowledge Transfer ({ktTasks.length} Tasks)
              </h5>
              <div className="space-y-1.5 text-muted-foreground">
                {ktTasks.length === 0 ? (
                  <p className="text-[11px]">No handover tasks assigned yet.</p>
                ) : (
                  ktTasks.map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center py-1 border-b border-border/40">
                      <span>{t.title}</span>
                      <Badge variant="outline" className="text-[9px] capitalize">{t.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Asset Returns */}
            <div className="border rounded-lg p-4 space-y-2">
              <h5 className="font-bold flex items-center gap-1.5 text-foreground">
                <Laptop className="h-4 w-4 text-primary" /> Company Asset Returns ({assets.length} Items)
              </h5>
              <div className="space-y-1.5 text-muted-foreground">
                {assets.length === 0 ? (
                  <p className="text-[11px]">No tracked assets allocated.</p>
                ) : (
                  assets.map((a: any) => (
                    <div key={a.id} className="flex justify-between items-center py-1 border-b border-border/40">
                      <span>{a.asset_name}</span>
                      <Badge variant="outline" className="text-[9px] capitalize">{a.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
