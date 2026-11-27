import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Briefcase,
  Calendar,
  Clock,
  Heart,
  FileText,
  Star,
  Receipt,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Save,
  X,
  Download,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Eye,
} from "lucide-react";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { EditLeaveRequestDialog } from "@/components/leaves/EditLeaveRequestDialog";
import {
  EditLeaveBalanceDialog,
  type EditLeaveBalanceTarget,
} from "@/components/leaves/EditLeaveBalanceDialog";
import { PerformanceGoalsManager } from "@/components/performance/PerformanceGoalsManager";
import { PerformanceAppraisalsManager } from "@/components/performance/PerformanceAppraisalsManager";
import type { LeaveRequest } from "@/lib/leave";
import {
  getVerificationStatusBadge,
  getExpiryStatus,
  getSecureDocumentUrl,
  DocumentItem,
} from "@/lib/documents";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmployeeProfileDrawerProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrollFace?: (employee: any) => void;
  onProfileUpdated?: () => void;
}

export function EmployeeProfileDrawer({
  employeeId,
  open,
  onOpenChange,
  onEnrollFace,
  onProfileUpdated,
}: EmployeeProfileDrawerProps) {
  const session = useSession();
  const isHrOrAdmin = session.isAdmin || session.isSuperadmin;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Edit Mode States
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState<any>({});

  const [isEditingEmployment, setIsEditingEmployment] = useState(false);
  const [employmentForm, setEmploymentForm] = useState<any>({});

  // Modals inside drawer
  const [addDocModalOpen, setAddDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("Identity Proof");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [addReviewModalOpen, setAddReviewModalOpen] = useState(false);
  const [reviewPeriod, setReviewPeriod] = useState("Q1 2026");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewGoals, setReviewGoals] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  // Leave Edit & Balance Adjustment States (HR & Admin)
  const [editLeaveOpen, setEditLeaveOpen] = useState(false);
  const [editingLeaveReq, setEditingLeaveReq] = useState<LeaveRequest | null>(null);
  const [editBalanceTarget, setEditBalanceTarget] = useState<EditLeaveBalanceTarget | null>(null);

  // 1. Fetch Employee Profile
  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ["employee-profile-drawer", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select(`
          *,
          departments(name),
          manager:employees!employees_manager_id_fkey(full_name, employee_code, email),
          shifts(name, start_time, end_time, work_days)
        `)
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!employeeId,
  });

  // Populate edit forms when employee loads
  useEffect(() => {
    if (employee) {
      setPersonalForm({
        phone: employee.phone || "",
        personal_email: employee.personal_email || "",
        gender: employee.gender || "male",
        date_of_birth: employee.date_of_birth || "",
        marital_status: employee.marital_status || "single",
        blood_group: employee.blood_group || "O+",
        nationality: employee.nationality || "Indian",
        current_address: employee.current_address || "",
        permanent_address: employee.permanent_address || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
        emergency_contact_relation: employee.emergency_contact_relation || "Spouse",
      });

      setEmploymentForm({
        designation: employee.designation || "Employee",
        employment_type: employee.employment_type || "full_time",
        work_location: employee.work_location || "onsite",
        joining_date: employee.joining_date || "",
        probation_end_date: employee.probation_end_date || "",
        notice_period_days: employee.notice_period_days || 30,
        status: employee.status || "active",
      });
    }
  }, [employee]);

  // 2. Fetch Attendance
  const { data: attendanceLogs = [], isLoading: attLoading } = useQuery({
    queryKey: ["employee-drawer-attendance", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && activeTab === "attendance",
  });

  // 3. Fetch Leaves
  const { data: leaveRequests = [], isLoading: leavesLoading } = useQuery({
    queryKey: ["employee-drawer-leaves", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name, color)")
        .eq("employee_id", employeeId)
        .order("from_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && (activeTab === "leave" || activeTab === "overview"),
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["employee-drawer-balances", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name, color)")
        .eq("employee_id", employeeId)
        .eq("year", currentYear);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && (activeTab === "leave" || activeTab === "overview"),
  });

  // 4. Fetch Documents
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["employee-drawer-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && activeTab === "documents",
  });

  // 5. Fetch Performance Reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["employee-drawer-reviews", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await (supabase.from as any)("performance_reviews")
        .select("*, reviewer:employees!performance_reviews_reviewer_id_fkey(full_name)")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && activeTab === "performance",
  });

  // 6. Fetch Expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["employee-drawer-expenses", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await (supabase.from as any)("expense_claims")
        .select("*")
        .eq("employee_id", employeeId)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && activeTab === "expenses",
  });

  // 7. Fetch Activity History
  const { data: activities = [], isLoading: activityLoading } = useQuery({
    queryKey: ["employee-drawer-activity", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await (supabase.from as any)("employee_profile_history")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employeeId && activeTab === "activity",
  });

  // Save Personal Details Mutation
  const savePersonalMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) return;
      const { error } = await supabase
        .from("employees")
        .update({
          phone: personalForm.phone || null,
          personal_email: personalForm.personal_email || null,
          gender: personalForm.gender,
          date_of_birth: personalForm.date_of_birth || null,
          marital_status: personalForm.marital_status,
          blood_group: personalForm.blood_group,
          nationality: personalForm.nationality,
          current_address: personalForm.current_address || null,
          permanent_address: personalForm.permanent_address || null,
          emergency_contact_name: personalForm.emergency_contact_name || null,
          emergency_contact_phone: personalForm.emergency_contact_phone || null,
          emergency_contact_relation: personalForm.emergency_contact_relation || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employeeId);

      if (error) throw error;

      // Log in profile history
      await (supabase.from as any)("employee_profile_history").insert({
        employee_id: employeeId,
        changed_by: session.user?.id || null,
        action: "PERSONAL_DETAILS_UPDATED",
        changes: personalForm,
      });
    },
    onSuccess: () => {
      toast.success("Personal details updated successfully");
      setIsEditingPersonal(false);
      queryClient.invalidateQueries({ queryKey: ["employee-profile-drawer", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
      onProfileUpdated?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update personal details");
    },
  });

  // Save Employment Details Mutation
  const saveEmploymentMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) return;
      const { error } = await supabase
        .from("employees")
        .update({
          designation: employmentForm.designation,
          employment_type: employmentForm.employment_type,
          work_location: employmentForm.work_location,
          joining_date: employmentForm.joining_date || null,
          probation_end_date: employmentForm.probation_end_date || null,
          notice_period_days: Number(employmentForm.notice_period_days) || 30,
          status: employmentForm.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employeeId);

      if (error) throw error;

      // Log in profile history
      await (supabase.from as any)("employee_profile_history").insert({
        employee_id: employeeId,
        changed_by: session.user?.id || null,
        action: "EMPLOYMENT_DETAILS_UPDATED",
        changes: employmentForm,
      });
    },
    onSuccess: () => {
      toast.success("Employment details updated successfully");
      setIsEditingEmployment(false);
      queryClient.invalidateQueries({ queryKey: ["employee-profile-drawer", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
      onProfileUpdated?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update employment details");
    },
  });

  // Handle Document Upload
  async function handleUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docTitle.trim() || !docFile || !employeeId) {
      toast.error("Please provide a title and select a file");
      return;
    }

    setUploadingDoc(true);
    try {
      const ext = docFile.name.split(".").pop();
      const path = `${employeeId}/${Date.now()}_${docFile.name.replace(/\s+/g, "_")}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, docFile);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(uploadData.path);

      const { error: dbErr } = await supabase.from("documents").insert({
        title: docTitle.trim(),
        category: docCategory,
        file_url: urlData.publicUrl,
        file_name: docFile.name,
        file_size: docFile.size,
        file_type: ext || "file",
        document_type: docCategory,
        employee_id: employeeId,
        uploaded_by: session.user?.id || null,
      });

      if (dbErr) throw dbErr;

      toast.success("Document attached successfully");
      setAddDocModalOpen(false);
      setDocTitle("");
      setDocFile(null);
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-documents", employeeId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  }

  // Handle Add Performance Review
  async function handleSaveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;

    setSavingReview(true);
    try {
      const { error } = await (supabase.from as any)("performance_reviews").insert({
        employee_id: employeeId,
        reviewer_id: session.employeeId || null,
        review_period: reviewPeriod,
        rating: Number(reviewRating),
        goals: reviewGoals.trim() || null,
        feedback: reviewFeedback.trim() || null,
        status: "completed",
      });

      if (error) throw error;

      toast.success("Performance review recorded");
      setAddReviewModalOpen(false);
      setReviewGoals("");
      setReviewFeedback("");
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-reviews", employeeId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save performance review");
    } finally {
      setSavingReview(false);
    }
  }

  // Approve / Reject Leave Request inline
  async function handleLeaveDecision(requestId: string, status: "approved" | "rejected") {
    try {
      const comment = `Direct decision from Employee Profile by ${session.fullName}`;
      const { error } =
        status === "approved"
          ? await supabase.rpc("approve_leave_transactional", {
              p_request_id: requestId,
              p_comment: comment,
            })
          : await supabase.rpc("reject_leave_transactional", {
              p_request_id: requestId,
              p_comment: comment,
            });

      if (error) throw error;
      toast.success(`Leave request ${status}`);
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-leaves", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-balances", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-manager-leave-approvals"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update leave request");
    }
  }

  // Approve / Reject Expense Claim inline
  async function handleExpenseDecision(claimId: string, status: "approved" | "rejected") {
    try {
      if (status === "approved") {
        const { error } = await supabase.rpc("approve_expense_claim", {
          p_claim_id: claimId,
          p_level: session.isAdmin || session.isSuperadmin ? "finance" : "manager",
          p_notes: "Approved via Employee Profile drawer",
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("reject_expense_claim", {
          p_claim_id: claimId,
          p_reason: "Declined via Employee Profile drawer",
        });
        if (error) throw error;
      }

      toast.success(`Expense claim ${status}`);
      queryClient.invalidateQueries({ queryKey: ["employee-drawer-expenses", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update claim");
    }
  }

  const initials = (employee?.full_name || "Employee")
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl md:max-w-4xl p-0 flex flex-col h-full overflow-hidden"
      >
        <SheetHeader className="p-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-lg overflow-hidden shrink-0">
                {employee?.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={employee.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-xl font-bold tracking-tight">
                    {employee?.full_name || "Employee Profile"}
                  </SheetTitle>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {employee?.employee_code || "EMP---"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      employee?.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                        : "bg-amber-500/10 text-amber-600 border-amber-200"
                    }`}
                  >
                    {employee?.status || "Active"}
                  </Badge>
                </div>
                <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{employee?.designation || "Designation Not Set"}</span>
                  <span>•</span>
                  <span>{employee?.departments?.name || "General"}</span>
                  <span>•</span>
                  <span>{employee?.email}</span>
                </SheetDescription>
              </div>
            </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-xs border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <MapPin className="h-3.5 w-3.5" />
                  GPS Geofence
                </Badge>
              </div>
          </div>
        </SheetHeader>

        {/* 9 Profile Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-6 bg-muted/20 overflow-x-auto">
            <TabsList className="bg-transparent h-11 p-0 gap-4 flex w-max">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="personal"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Personal Details
              </TabsTrigger>
              <TabsTrigger
                value="employment"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Employment
              </TabsTrigger>
              <TabsTrigger
                value="attendance"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Attendance
              </TabsTrigger>
              <TabsTrigger
                value="leave"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Leave
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Expenses
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2.5"
              >
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ================================================================= */}
            {/* TAB 1: OVERVIEW                                                   */}
            {/* ================================================================= */}
            <TabsContent value="overview" className="space-y-6 m-0">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Work Shift</p>
                    <p className="text-sm font-bold truncate">
                      {employee?.shifts?.name || "General (9 AM - 6 PM)"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Employment Type</p>
                    <p className="text-sm font-bold capitalize">
                      {employee?.employment_type?.replace("_", "-") || "Full-Time"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Work Location</p>
                    <p className="text-sm font-bold capitalize">
                      {employee?.work_location || "Onsite"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Joining Date</p>
                    <p className="text-sm font-bold">
                      {employee?.joining_date || "Not set"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Manager & Emergency Contact Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                      Reporting Manager
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    {employee?.manager ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold">{employee.manager.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{employee.manager.employee_code}</p>
                        <p className="text-xs text-muted-foreground">{employee.manager.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No manager assigned (Direct Executive)</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-rose-500" />
                      Emergency Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    {employee?.emergency_contact_name ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold">
                          {employee.emergency_contact_name}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({employee.emergency_contact_relation || "Contact"})
                          </span>
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {employee.emergency_contact_phone || "No phone registered"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No emergency contact provided</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Leave Balance Snapshot */}
              <Card>
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Annual Leave Balance Snapshot
                  </CardTitle>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setActiveTab("leave")}
                  >
                    View All Leaves →
                  </Button>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {leaveBalances.map((b: any) => (
                      <div key={b.id} className="rounded-lg border p-3 text-center bg-muted/20">
                        <p className="text-[11px] font-medium text-muted-foreground truncate">
                          {b.leave_types?.name || "Leave"}
                        </p>
                        <p className="text-lg font-bold text-foreground mt-0.5">
                          {b.total_days - b.used_days}
                          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                            / {b.total_days}d
                          </span>
                        </p>
                      </div>
                    ))}
                    {leaveBalances.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-4 italic py-2">
                        No leave balance records found for current calendar year.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 2: PERSONAL DETAILS                                           */}
            {/* ================================================================= */}
            <TabsContent value="personal" className="space-y-6 m-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Personal & Contact Profile</h3>
                {!isEditingPersonal ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setIsEditingPersonal(true)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Personal Details</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8"
                      onClick={() => setIsEditingPersonal(false)}
                      disabled={savePersonalMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => savePersonalMutation.mutate()}
                      disabled={savePersonalMutation.isPending}
                    >
                      {savePersonalMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>Save Changes</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Mobile Phone</Label>
                  {isEditingPersonal ? (
                    <Input
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 font-mono">
                      {employee?.phone || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Personal Email</Label>
                  {isEditingPersonal ? (
                    <Input
                      value={personalForm.personal_email}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, personal_email: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40">
                      {employee?.personal_email || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date of Birth</Label>
                  {isEditingPersonal ? (
                    <Input
                      type="date"
                      value={personalForm.date_of_birth}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, date_of_birth: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40">
                      {employee?.date_of_birth || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gender</Label>
                  {isEditingPersonal ? (
                    <Select
                      value={personalForm.gender}
                      onValueChange={(val) => setPersonalForm({ ...personalForm, gender: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-Binary</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 capitalize">
                      {employee?.gender || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Blood Group</Label>
                  {isEditingPersonal ? (
                    <Select
                      value={personalForm.blood_group}
                      onValueChange={(val) => setPersonalForm({ ...personalForm, blood_group: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                          <SelectItem key={bg} value={bg}>
                            {bg}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 font-semibold">
                      {employee?.blood_group || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Marital Status</Label>
                  {isEditingPersonal ? (
                    <Select
                      value={personalForm.marital_status}
                      onValueChange={(val) =>
                        setPersonalForm({ ...personalForm, marital_status: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 capitalize">
                      {employee?.marital_status || "—"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Current Residential Address</Label>
                {isEditingPersonal ? (
                  <Textarea
                    rows={2}
                    value={personalForm.current_address}
                    onChange={(e) =>
                      setPersonalForm({ ...personalForm, current_address: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-xs p-2.5 rounded-md bg-muted/40">
                    {employee?.current_address || "No address on file"}
                  </p>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" />
                  Emergency Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Contact Name</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalForm.emergency_contact_name}
                        onChange={(e) =>
                          setPersonalForm({ ...personalForm, emergency_contact_name: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-xs font-medium">{employee?.emergency_contact_name || "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Relationship</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalForm.emergency_contact_relation}
                        onChange={(e) =>
                          setPersonalForm({
                            ...personalForm,
                            emergency_contact_relation: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-xs font-medium">
                        {employee?.emergency_contact_relation || "—"}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Phone Number</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalForm.emergency_contact_phone}
                        onChange={(e) =>
                          setPersonalForm({
                            ...personalForm,
                            emergency_contact_phone: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-xs font-mono font-medium">
                        {employee?.emergency_contact_phone || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bank & Tax Credentials */}
              <div className="rounded-lg border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Bank & Tax Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Account Holder</Label>
                    <p className="text-xs font-medium">{employee?.bank_account_holder || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Bank Name</Label>
                    <p className="text-xs font-medium">{employee?.bank_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Account Number</Label>
                    <p className="text-xs font-mono font-medium">{employee?.bank_account_number || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">IFSC / Code</Label>
                    <p className="text-xs font-mono font-medium">{employee?.bank_ifsc_code || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Branch</Label>
                    <p className="text-xs font-medium">{employee?.bank_branch || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">PAN / Tax ID</Label>
                    <p className="text-xs font-mono font-medium">{employee?.pan_number || "—"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 3: EMPLOYMENT                                                 */}
            {/* ================================================================= */}
            <TabsContent value="employment" className="space-y-6 m-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Organizational & Contract Details</h3>
                {!isEditingEmployment ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setIsEditingEmployment(true)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Employment</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8"
                      onClick={() => setIsEditingEmployment(false)}
                      disabled={saveEmploymentMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => saveEmploymentMutation.mutate()}
                      disabled={saveEmploymentMutation.isPending}
                    >
                      {saveEmploymentMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>Save Changes</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Unique Employee ID</Label>
                  <p className="text-xs p-2 rounded-md bg-muted/40 font-mono font-bold">
                    {employee?.employee_code}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Department</Label>
                  <p className="text-xs p-2 rounded-md bg-muted/40 font-medium">
                    {employee?.departments?.name || "General"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Designation</Label>
                  {isEditingEmployment ? (
                    <Input
                      value={employmentForm.designation}
                      onChange={(e) =>
                        setEmploymentForm({ ...employmentForm, designation: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 font-medium">
                      {employee?.designation || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Employment Status</Label>
                  {isEditingEmployment ? (
                    <Select
                      value={employmentForm.status}
                      onValueChange={(val) => setEmploymentForm({ ...employmentForm, status: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 capitalize font-medium">
                      {employee?.status || "active"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Employment Type</Label>
                  {isEditingEmployment ? (
                    <Select
                      value={employmentForm.employment_type}
                      onValueChange={(val) =>
                        setEmploymentForm({ ...employmentForm, employment_type: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-Time</SelectItem>
                        <SelectItem value="part_time">Part-Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 capitalize">
                      {employee?.employment_type?.replace("_", "-") || "Full-Time"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Work Location</Label>
                  {isEditingEmployment ? (
                    <Select
                      value={employmentForm.work_location}
                      onValueChange={(val) =>
                        setEmploymentForm({ ...employmentForm, work_location: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onsite">Onsite (Office)</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 capitalize">
                      {employee?.work_location || "Onsite"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Joining Date</Label>
                  {isEditingEmployment ? (
                    <Input
                      type="date"
                      value={employmentForm.joining_date}
                      onChange={(e) =>
                        setEmploymentForm({ ...employmentForm, joining_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40">
                      {employee?.joining_date || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Notice Period (Days)</Label>
                  {isEditingEmployment ? (
                    <Input
                      type="number"
                      value={employmentForm.notice_period_days}
                      onChange={(e) =>
                        setEmploymentForm({ ...employmentForm, notice_period_days: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-xs p-2 rounded-md bg-muted/40 font-mono">
                      {employee?.notice_period_days ?? 30} days
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 4: ATTENDANCE                                                 */}
            {/* ================================================================= */}
            <TabsContent value="attendance" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Biometric Attendance Records</h3>
                  <p className="text-xs text-muted-foreground">Recent 30 check-ins and verification status.</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Check-in</th>
                      <th className="p-3">Check-out</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendanceLogs.map((att: any) => (
                      <tr key={att.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{att.date}</td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {att.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {att.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              att.status === "present"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                : att.status === "late"
                                ? "bg-amber-500/10 text-amber-600 border-amber-200"
                                : "bg-rose-500/10 text-rose-600 border-rose-200"
                            }`}
                          >
                            {att.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground capitalize">{att.method || "GPS Geofence"}</td>
                      </tr>
                    ))}
                    {attendanceLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground italic">
                          No attendance records logged for this employee yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 5: LEAVE                                                      */}
            {/* ================================================================= */}
            <TabsContent value="leave" className="space-y-4 m-0">
              <h3 className="text-sm font-bold">Leave Requests & Allocations</h3>

              {/* Leave Balances Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {leaveBalances.map((bal: any) => {
                  const remaining = bal.remaining ?? Number(bal.total ?? 0) - Number(bal.used ?? 0);
                  return (
                    <Card key={bal.id} className="p-3 bg-card">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-[11px] font-medium text-muted-foreground truncate">
                          {bal.leave_types?.name}
                        </p>
                        {isHrOrAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                            title="Edit leave balance"
                            onClick={() => {
                              setEditBalanceTarget({
                                employeeId: bal.employee_id,
                                employeeName: employee?.full_name,
                                leaveTypeId: bal.leave_type_id,
                                leaveTypeName: bal.leave_types?.name || "Leave",
                                year: bal.year,
                                total: Number(bal.total ?? 0),
                                used: Number(bal.used ?? 0),
                                carriedForward: Number(bal.carried_forward ?? 0),
                              });
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-lg font-bold mt-1">
                        {remaining}{" "}
                        <span className="text-xs font-normal text-muted-foreground">left</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Used: {bal.used ?? 0}d / {bal.total ?? 0}d
                      </p>
                    </Card>
                  );
                })}
              </div>

              {/* Leave History Table */}
              <div className="rounded-lg border overflow-hidden mt-4">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="p-3">Type</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Days</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaveRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{req.leave_types?.name || "Leave"}</td>
                        <td className="p-3 text-muted-foreground">
                          {req.from_date} to {req.to_date}
                        </td>
                        <td className="p-3 font-semibold">{req.days}d</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[150px]">
                          {req.reason || "—"}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                : req.status === "pending"
                                ? "bg-amber-500/10 text-amber-600 border-amber-200"
                                : "bg-rose-500/10 text-rose-600 border-rose-200"
                            }`}
                          >
                            {req.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {req.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                                  onClick={() => handleLeaveDecision(req.id, "approved")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                                  onClick={() => handleLeaveDecision(req.id, "rejected")}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {isHrOrAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => {
                                  setEditingLeaveReq(req as LeaveRequest);
                                  setEditLeaveOpen(true);
                                }}
                              >
                                <Edit2 className="h-3 w-3" /> Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {leaveRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground italic">
                          No leave applications filed by this employee.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 6: DOCUMENTS                                                  */}
            {/* ================================================================= */}
            <TabsContent value="documents" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Associated Employment Documents</h3>
                  <p className="text-xs text-muted-foreground">ID proofs, contracts, certifications, and policies.</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => setAddDocModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Attach Document</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc: any) => {
                  const verify = getVerificationStatusBadge(doc.verification_status);
                  const expiry = getExpiryStatus(doc.expiry_date);

                  return (
                    <Card
                      key={doc.id}
                      className="p-3.5 flex flex-col justify-between hover:border-primary/40 transition cursor-pointer group space-y-2.5"
                      onClick={() => {
                        setPreviewDoc(doc);
                        setPreviewOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                              {doc.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {doc.document_type || doc.category} •{" "}
                              {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : "File"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={verify.colorClass + " text-[10px]"}>
                            {verify.label}
                          </Badge>
                        </div>
                      </div>

                      {doc.expiry_date && (
                        <div className="pt-0.5">
                          <Badge variant="outline" className={expiry.colorClass + " text-[10px]"}>
                            {expiry.label}
                          </Badge>
                        </div>
                      )}

                      <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Click card to preview</span>
                        <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {documents.length === 0 && (
                  <div className="col-span-2 p-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                    No documents attached for this employee yet. Click Attach Document to upload.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 7: PERFORMANCE                                                */}
            {/* ================================================================= */}
            <TabsContent value="performance" className="space-y-6 m-0">
              <PerformanceGoalsManager filterEmployeeId={employeeId || undefined} />
              <PerformanceAppraisalsManager filterEmployeeId={employeeId || undefined} />
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 8: EXPENSES                                                   */}
            {/* ================================================================= */}
            <TabsContent value="expenses" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Expense Claims & Reimbursements</h3>
                  <p className="text-xs text-muted-foreground">Submitted employee expenses and approvals.</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="p-3">Claim</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Receipt</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenses.map((exp: any) => (
                      <tr key={exp.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{exp.title}</td>
                        <td className="p-3 text-muted-foreground">{exp.category}</td>
                        <td className="p-3 text-muted-foreground">{exp.expense_date}</td>
                        <td className="p-3 font-bold font-mono">₹{exp.amount}</td>
                        <td className="p-3">
                          {exp.receipt_url ? (
                            <a
                              href={exp.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              exp.status === "approved" || exp.status === "reimbursed"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                : exp.status === "pending"
                                ? "bg-amber-500/10 text-amber-600 border-amber-200"
                                : "bg-rose-500/10 text-rose-600 border-rose-200"
                            }`}
                          >
                            {exp.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {(exp.status === "pending" || exp.status === "pending_finance") && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                                onClick={() => handleExpenseDecision(exp.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                                onClick={() => handleExpenseDecision(exp.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                          No expense claims filed by this employee.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* TAB 9: ACTIVITY                                                   */}
            {/* ================================================================= */}
            <TabsContent value="activity" className="space-y-4 m-0">
              <h3 className="text-sm font-bold">Audit Trail & Profile Lifecycle</h3>

              <div className="space-y-3">
                {activities.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-3 text-xs border-l-2 border-primary/40 pl-4 py-1">
                    <div className="flex-1 space-y-0.5">
                      <p className="font-semibold text-foreground capitalize">
                        {act.action?.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(act.created_at).toLocaleString()}
                      </p>
                      {act.changes && (
                        <pre className="text-[10px] bg-muted/40 p-2 rounded mt-1 overflow-x-auto text-muted-foreground">
                          {JSON.stringify(act.changes, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-xs text-muted-foreground italic p-4 text-center">
                    No activity logs recorded yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Modal: Attach Document */}
        <Dialog open={addDocModalOpen} onOpenChange={setAddDocModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Attach Document to Employee</DialogTitle>
              <DialogDescription className="text-xs">
                Upload official contracts, identification proofs, or certificates.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadDoc} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Document Title</Label>
                <Input
                  placeholder="Enter document title"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Identity Proof", "Offer Letter", "Employment Contract", "Educational Certificate", "Tax Document", "Resume", "Other"].map(
                      (cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">File</Label>
                <Input
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDocModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={uploadingDoc} className="gap-1.5">
                  {uploadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>Upload & Attach</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Add Review */}
        <Dialog open={addReviewModalOpen} onOpenChange={setAddReviewModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Record Performance Review</DialogTitle>
              <DialogDescription className="text-xs">
                Rate employee achievements, assign goals, and share supervisor appraisal feedback.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveReview} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Review Period</Label>
                  <Input
                    placeholder="Enter review period"
                    value={reviewPeriod}
                    onChange={(e) => setReviewPeriod(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Overall Rating (1 - 5)</Label>
                  <Select value={reviewRating} onValueChange={setReviewRating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">★★★★★ 5 - Outstanding</SelectItem>
                      <SelectItem value="4">★★★★☆ 4 - Exceeds Expectations</SelectItem>
                      <SelectItem value="3">★★★☆☆ 3 - Meets Expectations</SelectItem>
                      <SelectItem value="2">★★☆☆☆ 2 - Needs Improvement</SelectItem>
                      <SelectItem value="1">★☆☆☆☆ 1 - Unsatisfactory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Objectives & Target Goals</Label>
                <Textarea
                  rows={2}
                  placeholder="Key milestones completed or next targets..."
                  value={reviewGoals}
                  onChange={(e) => setReviewGoals(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supervisor Feedback Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Detailed feedback and growth appraisal..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddReviewModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingReview}>
                  {savingReview ? "Recording..." : "Save Performance Review"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Preview Document Modal */}
        <DocumentPreviewModal
          document={previewDoc}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />

        {/* Edit Leave Request Modal (HR & Admin across all levels/statuses) */}
        <EditLeaveRequestDialog
          open={editLeaveOpen}
          onOpenChange={setEditLeaveOpen}
          request={editingLeaveReq}
        />

        {/* Edit Leave Balance Modal (HR & Admin) */}
        <EditLeaveBalanceDialog
          target={editBalanceTarget}
          onOpenChange={(o) => !o && setEditBalanceTarget(null)}
        />
      </SheetContent>
    </Sheet>
  );
}
