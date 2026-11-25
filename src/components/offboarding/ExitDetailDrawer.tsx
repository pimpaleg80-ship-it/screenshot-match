import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EmployeeExit,
  ExitKtTask,
  ExitAssetReturn,
  ExitClearance,
  ExitInterview,
  ExitFnFSettlement,
  ExitHistory,
  EXIT_STATUS_CONFIG,
  calculateFnFSettlement,
  generateRelievingLetterPDF,
  generateExperienceCertificatePDF,
} from "@/lib/offboarding";
import { formatINR } from "@/lib/payroll";
import {
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Laptop,
  CheckSquare,
  ShieldCheck,
  MessageSquare,
  DollarSign,
  History,
  Clock,
  Sparkles,
} from "lucide-react";

interface ExitDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exit: EmployeeExit | null;
  userId: string;
  isAdmin: boolean;
  isManager: boolean;
}

export function ExitDetailDrawer({
  open,
  onOpenChange,
  exit,
  userId,
  isAdmin,
  isManager,
}: ExitDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("overview");

  // New KT task state
  const [newKtTitle, setNewKtTitle] = useState("");
  const [newKtDesc, setNewKtDesc] = useState("");

  // New Asset return state
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("Hardware");
  const [newSerial, setNewSerial] = useState("");

  // Exit Interview state
  const [cultureRating, setCultureRating] = useState<number>(4);
  const [mgmtRating, setMgmtRating] = useState<number>(4);
  const [growthRating, setGrowthRating] = useState<number>(3);
  const [compRating, setCompRating] = useState<number>(3);
  const [workLifeRating, setWorkLifeRating] = useState<number>(4);
  const [positiveNotes, setPositiveNotes] = useState("");
  const [improveNotes, setImproveNotes] = useState("");
  const [confidentialNotes, setConfidentialNotes] = useState("");

  // FnF state
  const [payableDays, setPayableDays] = useState<number>(20);
  const [encashmentDays, setEncashmentDays] = useState<number>(5);
  const [gratuity, setGratuity] = useState<number>(0);
  const [noticeShortfall, setNoticeShortfall] = useState<number>(0);
  const [assetDeductions, setAssetDeductions] = useState<number>(0);

  // Queries for Sub-tables
  const { data: ktTasks = [] } = useQuery({
    queryKey: ["exit-kt-tasks", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return [];
      const { data, error } = await supabase
        .from("exit_kt_tasks")
        .select("*")
        .eq("exit_id", exit.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ExitKtTask[];
    },
    enabled: !!exit?.id,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["exit-assets", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return [];
      const { data, error } = await supabase
        .from("exit_asset_returns")
        .select("*")
        .eq("exit_id", exit.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ExitAssetReturn[];
    },
    enabled: !!exit?.id,
  });

  const { data: clearances = [] } = useQuery({
    queryKey: ["exit-clearances", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return [];
      const { data, error } = await supabase
        .from("exit_clearances")
        .select("*")
        .eq("exit_id", exit.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ExitClearance[];
    },
    enabled: !!exit?.id,
  });

  const { data: interview } = useQuery({
    queryKey: ["exit-interview", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return null;
      const { data, error } = await supabase
        .from("exit_interviews")
        .select("*")
        .eq("exit_id", exit.id)
        .maybeSingle();
      if (error) throw error;
      return data as ExitInterview | null;
    },
    enabled: !!exit?.id,
  });

  const { data: fnf } = useQuery({
    queryKey: ["exit-fnf", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return null;
      const { data, error } = await supabase
        .from("exit_fnf_settlements")
        .select("*")
        .eq("exit_id", exit.id)
        .maybeSingle();
      if (error) throw error;
      return data as ExitFnFSettlement | null;
    },
    enabled: !!exit?.id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["exit-history", exit?.id],
    queryFn: async () => {
      if (!exit?.id) return [];
      const { data, error } = await supabase
        .from("exit_history")
        .select("*")
        .eq("exit_id", exit.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExitHistory[];
    },
    enabled: !!exit?.id,
  });

  // Review Resignation Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ action, notes }: { action: "approve" | "reject"; notes: string }) => {
      if (!exit) return;
      const { data, error } = await supabase.rpc("review_employee_resignation", {
        _exit_id: exit.id,
        _reviewer_id: userId,
        _action: action,
        _agreed_lwd: exit.requested_last_working_day,
        _notice_waiver: exit.notice_waiver_days,
        _notes: notes,
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.error || "Review failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-exits"] });
      queryClient.invalidateQueries({ queryKey: ["exit-history"] });
      toast.success("Resignation status updated.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update resignation status.");
    },
  });

  // Add KT Task Mutation
  const addKtMutation = useMutation({
    mutationFn: async () => {
      if (!exit || !newKtTitle.trim()) return;
      const { error } = await supabase.from("exit_kt_tasks").insert({
        exit_id: exit.id,
        organization_id: exit.organization_id ?? null,
        title: newKtTitle.trim(),
        description: newKtDesc.trim() || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-kt-tasks", exit?.id] });
      setNewKtTitle("");
      setNewKtDesc("");
      toast.success("Knowledge transfer task added.");
    },
  });

  // Toggle KT Task Mutation
  const toggleKtMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "completed" }) => {
      const { error } = await supabase
        .from("exit_kt_tasks")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-kt-tasks", exit?.id] });
    },
  });

  // Add Asset Mutation
  const addAssetMutation = useMutation({
    mutationFn: async () => {
      if (!exit || !newAssetName.trim()) return;
      const { error } = await supabase.from("exit_asset_returns").insert({
        exit_id: exit.id,
        organization_id: exit.organization_id ?? null,
        asset_name: newAssetName.trim(),
        asset_type: newAssetType,
        serial_number: newSerial.trim() || null,
        status: "allocated",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-assets", exit?.id] });
      setNewAssetName("");
      setNewSerial("");
      toast.success("Company asset registered for return.");
    },
  });

  // Toggle Asset Status Mutation
  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const returnDate = status === "returned" ? (new Date().toISOString().split("T")[0] ?? null) : null;
      const { error } = await supabase
        .from("exit_asset_returns")
        .update({
          status,
          returned_date: returnDate,
          verified_by: userId,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-assets", exit?.id] });
      toast.success("Asset status updated.");
    },
  });

  // Update Department Clearance Mutation
  const updateClearanceMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: "cleared" | "flagged"; remarks: string }) => {
      const { error } = await supabase
        .from("exit_clearances")
        .update({
          status,
          cleared_by: userId,
          cleared_at: new Date().toISOString(),
          remarks: remarks || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-clearances", exit?.id] });
      toast.success("Department clearance recorded.");
    },
  });

  // Save Exit Interview Mutation
  const saveInterviewMutation = useMutation({
    mutationFn: async () => {
      if (!exit) return;
      const payload = {
        exit_id: exit.id,
        organization_id: exit.organization_id ?? null,
        conducted_by: userId,
        conducted_at: new Date().toISOString(),
        culture_rating: cultureRating,
        management_rating: mgmtRating,
        growth_rating: growthRating,
        compensation_rating: compRating,
        work_life_rating: workLifeRating,
        positive_feedback: positiveNotes || null,
        improvement_areas: improveNotes || null,
        confidential_notes: confidentialNotes || null,
      };

      const { error } = await supabase
        .from("exit_interviews")
        .upsert(payload, { onConflict: "exit_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-interview", exit?.id] });
      toast.success("Exit interview responses saved.");
    },
  });

  // Calculate & Save FnF Settlement Mutation
  const saveFnFMutation = useMutation({
    mutationFn: async () => {
      if (!exit) return;
      const basicSalaryRate = 25000;
      const monthlyGross = 50000;

      const calc = calculateFnFSettlement({
        basicSalaryRate,
        monthlyGross,
        workingDaysInFinalMonth: 30,
        payableDaysInFinalMonth: payableDays,
        leaveEncashmentDays: encashmentDays,
        gratuityAmount: gratuity,
        noticeShortfallDays: noticeShortfall,
        assetDeductions: assetDeductions,
      });

      const payload = {
        exit_id: exit.id,
        employee_id: exit.employee_id,
        organization_id: exit.organization_id ?? null,
        settlement_date: new Date().toISOString().split("T")[0]!,
        working_days_in_final_month: 30,
        payable_days_in_final_month: payableDays,
        basic_salary_rate: basicSalaryRate,
        unpaid_salary_amount: calc.unpaidSalaryAmount,
        leave_encashment_days: encashmentDays,
        leave_encashment_amount: calc.leaveEncashmentAmount,
        gratuity_amount: gratuity,
        notice_shortfall_days: noticeShortfall,
        notice_recovery_amount: calc.noticeRecoveryAmount,
        asset_deductions: assetDeductions,
        total_earnings: calc.totalEarnings,
        total_deductions: calc.totalDeductions,
        net_payable: calc.netPayable,
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("exit_fnf_settlements")
        .upsert(payload, { onConflict: "exit_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exit-fnf", exit?.id] });
      toast.success("Full & Final settlement approved.");
    },
  });

  // Finalize Exit Mutation (Relieves employee and generates certificates)
  const finalizeExitMutation = useMutation({
    mutationFn: async () => {
      if (!exit) return;
      const { data, error } = await supabase.rpc("finalize_employee_exit", {
        _exit_id: exit.id,
        _user_id: userId,
        _notes: "Clearances completed, FnF settled, certificates generated.",
      });
      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.error || "Finalization failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-exits"] });
      queryClient.invalidateQueries({ queryKey: ["exit-history", exit?.id] });
      toast.success("Employee formally relieved! Relieving & Experience certificates issued.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to finalize employee exit.");
    },
  });

  if (!exit) return null;

  const emp = exit.employee || {
    full_name: "Employee",
    employee_code: "EMP",
    designation: "Staff",
    joining_date: null,
    department: { name: "General" },
  };

  const statusConfig = EXIT_STATUS_CONFIG[exit.status] || EXIT_STATUS_CONFIG.submitted;

  // Handlers for PDF downloads
  function handleDownloadRelievingLetter() {
    if (!exit) return;
    const doc = generateRelievingLetterPDF({
      employee: {
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        designation: emp.designation,
        department_name: emp.department?.name,
        joining_date: emp.joining_date,
      },
      exit,
    });
    doc.save(`Relieving_Letter_${emp.employee_code}.pdf`);
  }

  function handleDownloadExperienceCert() {
    if (!exit) return;
    const doc = generateExperienceCertificatePDF({
      employee: {
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        designation: emp.designation,
        department_name: emp.department?.name,
        joining_date: emp.joining_date,
      },
      exit,
    });
    doc.save(`Experience_Certificate_${emp.employee_code}.pdf`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground font-semibold">
                  {emp.employee_code}
                </span>
                <Badge variant="outline" className={`text-xs ${statusConfig.badgeClass}`}>
                  {statusConfig.label}
                </Badge>
              </div>
              <SheetTitle className="text-xl font-bold">{emp.full_name}</SheetTitle>
              <SheetDescription className="text-xs">
                {emp.designation || "Staff Member"} • {emp.department?.name || "General"}
              </SheetDescription>
            </div>

            {isAdmin && exit.status !== "relieved" && (
              <Button
                size="sm"
                onClick={() => finalizeExitMutation.mutate()}
                disabled={finalizeExitMutation.isPending}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Finalize Separation & Relieve
              </Button>
            )}
          </div>

          {/* Stepper */}
          <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-semibold pt-2">
            {[
              { label: "Submitted", step: 1 },
              { label: "Approved", step: 2 },
              { label: "Clearance", step: 3 },
              { label: "Cleared", step: 4 },
              { label: "FnF Settled", step: 5 },
              { label: "Relieved", step: 6 },
            ].map((st) => {
              const isPastOrCurrent = (statusConfig.step || 0) >= st.step;
              return (
                <div key={st.step} className="flex flex-col items-center">
                  <div
                    className={`h-2 w-full rounded-full mb-1 transition-all ${
                      isPastOrCurrent ? "bg-primary" : "bg-muted"
                    }`}
                  />
                  <span className={isPastOrCurrent ? "text-foreground" : "text-muted-foreground"}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 border-b bg-muted/20">
            <TabsList className="bg-transparent h-10 p-0 gap-4 flex w-max overflow-x-auto">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="kt" className="text-xs">KT Handover ({ktTasks.length})</TabsTrigger>
              <TabsTrigger value="assets" className="text-xs">Asset Return ({assets.length})</TabsTrigger>
              <TabsTrigger value="clearance" className="text-xs">Department Clearance</TabsTrigger>
              <TabsTrigger value="interview" className="text-xs">Exit Interview</TabsTrigger>
              <TabsTrigger value="fnf" className="text-xs">FnF Settlement</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">Exit Docs</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">Audit History</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {/* Tab 1: Overview & Approvals */}
            <TabsContent value="overview" className="space-y-4 m-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Resignation Date</span>
                  <span className="font-semibold text-foreground">{exit.resignation_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Notice Period</span>
                  <span className="font-semibold text-foreground">{exit.notice_period_days} Days</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Requested LWD</span>
                  <span className="font-semibold text-foreground">{exit.requested_last_working_day}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Agreed LWD</span>
                  <span className="font-semibold text-emerald-600">{exit.agreed_last_working_day}</span>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                    Reason & Employee Comments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{exit.reason_category}</Badge>
                    <span className="text-muted-foreground">Separation Category</span>
                  </div>
                  <p className="text-foreground bg-muted/30 p-3 rounded-lg border italic">
                    "{exit.employee_reason}"
                  </p>
                </CardContent>
              </Card>

              {/* Review Actions if Pending */}
              {exit.status === "submitted" && (isAdmin || isManager) && (
                <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">
                      Action Required: Resignation Review
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Review resignation request, confirm last working day, and grant department clearance approvals.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => reviewMutation.mutate({ action: "approve", notes: "Approved by reviewer" })}
                        disabled={reviewMutation.isPending}
                        className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve Resignation & Start Clearance
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reviewMutation.mutate({ action: "reject", notes: "Declined after discussion" })}
                        disabled={reviewMutation.isPending}
                        className="text-xs gap-1.5"
                      >
                        <XCircle className="h-4 w-4" /> Decline Resignation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab 2: KT Checklist */}
            <TabsContent value="kt" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Knowledge Transfer (KT) Tasks</h4>
                  <p className="text-xs text-muted-foreground">Ensure transition of duties and handovers to assigned peers.</p>
                </div>
              </div>

              {/* Add KT Form */}
              <div className="p-3 rounded-lg border bg-muted/20 flex gap-2">
                <Input
                  placeholder="Task title (e.g. Handover microservice repo access & credentials)..."
                  value={newKtTitle}
                  onChange={(e) => setNewKtTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => addKtMutation.mutate()}
                  disabled={!newKtTitle.trim() || addKtMutation.isPending}
                  className="h-8 text-xs gap-1 shrink-0"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Add Task
                </Button>
              </div>

              {/* KT Tasks List */}
              <div className="space-y-2">
                {ktTasks.length === 0 ? (
                  <div className="text-center p-6 text-xs text-muted-foreground border rounded-lg">
                    No KT tasks created yet.
                  </div>
                ) : (
                  ktTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg border bg-card flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span className={t.status === "completed" ? "line-through text-muted-foreground" : ""}>
                            {t.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              t.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                                : "bg-amber-500/10 text-amber-600 border-amber-300"
                            }`}
                          >
                            {t.status.toUpperCase()}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground">{t.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={t.status === "completed" ? "ghost" : "outline"}
                        onClick={() =>
                          toggleKtMutation.mutate({
                            id: t.id,
                            status: t.status === "completed" ? "pending" : "completed",
                          })
                        }
                        className="h-7 text-xs"
                      >
                        {t.status === "completed" ? "Reopen" : "Mark Done"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Asset Returns */}
            <TabsContent value="assets" className="space-y-4 m-0">
              <div>
                <h4 className="font-bold text-sm">Company Asset Recovery</h4>
                <p className="text-xs text-muted-foreground">Verify physical return and condition of hardware and access badges.</p>
              </div>

              {/* Add Asset Form */}
              <div className="p-3 rounded-lg border bg-muted/20 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Asset name (e.g. MacBook Pro M2)..."
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Serial number (e.g. C02G91238)..."
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => addAssetMutation.mutate()}
                  disabled={!newAssetName.trim() || addAssetMutation.isPending}
                  className="h-8 text-xs gap-1"
                >
                  <Laptop className="h-3.5 w-3.5" /> Add Asset
                </Button>
              </div>

              {/* Asset List */}
              <div className="space-y-2">
                {assets.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg border bg-card flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {a.asset_name}
                        <Badge variant="outline" className="text-[10px]">{a.asset_type}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        SN: {a.serial_number || "Not specified"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={a.status}
                        onValueChange={(val) => updateAssetMutation.mutate({ id: a.id, status: val })}
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allocated" className="text-xs">Allocated</SelectItem>
                          <SelectItem value="returned" className="text-xs">Returned</SelectItem>
                          <SelectItem value="damaged" className="text-xs">Damaged</SelectItem>
                          <SelectItem value="lost" className="text-xs">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab 4: Department Clearance */}
            <TabsContent value="clearance" className="space-y-4 m-0">
              <div>
                <h4 className="font-bold text-sm">Four-Way Department Clearances</h4>
                <p className="text-xs text-muted-foreground">Mandatory sign-offs required prior to Full & Final settlement.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clearances.map((c) => (
                  <Card key={c.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold text-foreground">
                          {c.department_type}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={
                            c.status === "cleared"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                              : "bg-amber-500/10 text-amber-600 border-amber-300"
                          }
                        >
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {c.remarks && (
                        <p className="text-[11px] text-muted-foreground italic">"{c.remarks}"</p>
                      )}
                      {(isAdmin || isManager) && c.status !== "cleared" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateClearanceMutation.mutate({ id: c.id, status: "cleared", remarks: "All obligations satisfied." })}
                          disabled={updateClearanceMutation.isPending}
                          className="w-full text-xs gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Sign-Off Department Clearance
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Tab 5: Exit Interview */}
            <TabsContent value="interview" className="space-y-4 m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" /> Exit Feedback Questionnaire
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Evaluate organizational culture, management, and areas of growth to refine workplace retention.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company Culture & Values (1-5)</Label>
                      <Select value={String(cultureRating)} onValueChange={(v) => setCultureRating(Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map((r) => (<SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>))}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Management & Leadership (1-5)</Label>
                      <Select value={String(mgmtRating)} onValueChange={(v) => setMgmtRating(Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map((r) => (<SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>))}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Career Growth Opportunities (1-5)</Label>
                      <Select value={String(growthRating)} onValueChange={(v) => setGrowthRating(Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map((r) => (<SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>))}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Work-Life Balance (1-5)</Label>
                      <Select value={String(workLifeRating)} onValueChange={(v) => setWorkLifeRating(Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map((r) => (<SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Key Positive Highlights</Label>
                    <Textarea
                      value={positiveNotes}
                      onChange={(e) => setPositiveNotes(e.target.value)}
                      placeholder="What aspects of working at FlowPeople did you enjoy the most?"
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Areas of Improvement</Label>
                    <Textarea
                      value={improveNotes}
                      onChange={(e) => setImproveNotes(e.target.value)}
                      placeholder="Constructive feedback for future improvements..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </div>

                  {isAdmin && (
                    <div className="space-y-1.5 border-t pt-3">
                      <Label className="text-xs text-rose-600 font-semibold">Confidential HR Notes</Label>
                      <Textarea
                        value={confidentialNotes}
                        onChange={(e) => setConfidentialNotes(e.target.value)}
                        placeholder="Internal notes visible strictly to HR administrators..."
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={() => saveInterviewMutation.mutate()}
                    disabled={saveInterviewMutation.isPending}
                    className="text-xs"
                  >
                    Save Interview Feedback
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 6: FnF Settlement */}
            <TabsContent value="fnf" className="space-y-4 m-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" /> Full & Final Settlement Calculator
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Connected to payroll basic rates, unpaid month days, leave encashment, and asset recoveries.
                      </CardDescription>
                    </div>
                    {fnf && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-300">
                        {fnf.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Payable Days in Final Month</Label>
                      <Input
                        type="number"
                        value={payableDays}
                        onChange={(e) => setPayableDays(Number(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Leave Encashment (Days)</Label>
                      <Input
                        type="number"
                        value={encashmentDays}
                        onChange={(e) => setEncashmentDays(Number(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gratuity / Bonus (₹)</Label>
                      <Input
                        type="number"
                        value={gratuity}
                        onChange={(e) => setGratuity(Number(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notice Shortfall (Days)</Label>
                      <Input
                        type="number"
                        value={noticeShortfall}
                        onChange={(e) => setNoticeShortfall(Number(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Asset Damage Deductions (₹)</Label>
                      <Input
                        type="number"
                        value={assetDeductions}
                        onChange={(e) => setAssetDeductions(Number(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* FnF Summary Calculation */}
                  {(() => {
                    const calc = calculateFnFSettlement({
                      basicSalaryRate: 25000,
                      monthlyGross: 50000,
                      workingDaysInFinalMonth: 30,
                      payableDaysInFinalMonth: payableDays,
                      leaveEncashmentDays: encashmentDays,
                      gratuityAmount: gratuity,
                      noticeShortfallDays: noticeShortfall,
                      assetDeductions: assetDeductions,
                    });
                    return (
                      <div className="p-4 rounded-lg border bg-primary/5 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Unpaid Salary Days ({payableDays} days):</span>
                          <span className="font-semibold">{formatINR(calc.unpaidSalaryAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Leave Encashment ({encashmentDays} days):</span>
                          <span className="font-semibold">{formatINR(calc.leaveEncashmentAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Notice Shortfall Recovery ({noticeShortfall} days):</span>
                          <span className="font-semibold text-rose-600">-{formatINR(calc.noticeRecoveryAmount)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-sm">
                          <span>Net Payable Settlement:</span>
                          <span className="text-primary text-base">{formatINR(calc.netPayable)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {isAdmin && (
                    <Button
                      size="sm"
                      onClick={() => saveFnFMutation.mutate()}
                      disabled={saveFnFMutation.isPending}
                      className="text-xs"
                    >
                      Approve & Finalize Settlement
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 7: Exit Documents */}
            <TabsContent value="documents" className="space-y-4 m-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Official Exit Certification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Download authentic corporate separation documents once clearances and FnF are finalized.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div>
                        <h5 className="font-bold text-xs">Official Relieving Letter</h5>
                        <p className="text-[11px] text-muted-foreground">
                          Formal certification confirming successful completion of notice period and relieving of responsibilities.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadRelievingLetter}
                        className="w-full text-xs gap-1.5"
                      >
                        <Download className="h-4 w-4" /> Download Relieving Letter (PDF)
                      </Button>
                    </div>

                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div>
                        <h5 className="font-bold text-xs">Experience Certificate</h5>
                        <p className="text-[11px] text-muted-foreground">
                          Comprehensive certificate stating employment tenure, designation, department, and exemplary conduct.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadExperienceCert}
                        className="w-full text-xs gap-1.5"
                      >
                        <Download className="h-4 w-4" /> Download Experience Certificate (PDF)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 8: Audit History */}
            <TabsContent value="history" className="space-y-3 m-0">
              <h4 className="font-bold text-xs uppercase text-muted-foreground tracking-wider">
                Lifecycle Separation Timeline
              </h4>
              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
                  No audit history records available.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg border bg-card flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground capitalize">{h.action}</div>
                        {h.notes && <p className="text-[11px] text-muted-foreground">{h.notes}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
