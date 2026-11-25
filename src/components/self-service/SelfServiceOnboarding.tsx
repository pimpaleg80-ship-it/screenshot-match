import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  User,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  EmployeeOnboardingRecord,
  EmployeeOnboardingTask,
  getOnboardingStatusBadge,
  getTaskCategoryBadge,
} from "@/lib/onboarding";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentItem } from "@/lib/documents";

export function SelfServiceOnboarding() {
  const session = useSession();
  const [activeTaskForUpload, setActiveTaskForUpload] = useState<EmployeeOnboardingTask | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Form states
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [panNumber, setPanNumber] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [nationality, setNationality] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");

  // Load active onboarding for the current employee
  const {
    data: onboarding,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["my-active-onboarding", session.employeeId],
    enabled: Boolean(session.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_onboarding")
        .select(`
          *,
          onboarding_templates ( name )
        `)
        .eq("employee_id", session.employeeId!)
        .maybeSingle();

      if (error) {
        console.warn("No active onboarding record found:", error.message);
        return null;
      }
      return data as EmployeeOnboardingRecord | null;
    },
  });

  // Load employee tasks
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["my-onboarding-tasks", onboarding?.id],
    enabled: Boolean(onboarding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_onboarding_tasks")
        .select(`
          *,
          documents:document_id (
            id,
            title,
            file_url,
            file_name,
            verification_status
          )
        `)
        .eq("onboarding_id", onboarding!.id)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return (data ?? []) as EmployeeOnboardingTask[];
    },
  });

  // Populate employee personal and bank form
  useEffect(() => {
    if (!session.employeeId) return;

    supabase
      .from("employees")
      .select("*")
      .eq("id", session.employeeId)
      .single()
      .then(({ data }) => {
        if (data) {
          setBankName(data.bank_name || "");
          setBankAccountNumber(data.bank_account_number || "");
          setBankIfscCode(data.bank_ifsc_code || "");
          setBankBranch(data.bank_branch || "");
          setBankAccountHolder(data.bank_account_holder || data.full_name || "");
          setPanNumber(data.pan_number || "");

          setDateOfBirth(data.date_of_birth || "");
          setGender(data.gender || "");
          setMaritalStatus(data.marital_status || "");
          setBloodGroup(data.blood_group || "");
          setNationality(data.nationality || "");
          setCurrentAddress(data.current_address || "");
          setPermanentAddress(data.permanent_address || "");
          setEmergencyContactName(data.emergency_contact_name || "");
          setEmergencyContactPhone(data.emergency_contact_phone || "");
          setEmergencyContactRelation(data.emergency_contact_relation || "");
        }
      });
  }, [session.employeeId]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
        Checking your onboarding profile...
      </div>
    );
  }

  // If no onboarding record exists or already completed
  if (!onboarding) {
    return (
      <Card className="p-8 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h3 className="font-semibold text-base text-foreground">
          You are all set!
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Your onboarding records are active and verified. If you need to update any information or submit additional documents, visit the My Documents section.
        </p>
      </Card>
    );
  }

  const statusBadge = getOnboardingStatusBadge(onboarding.status);

  // Handle saving form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.employeeId) return;

    setIsSavingForm(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          bank_name: bankName.trim() || null,
          bank_account_number: bankAccountNumber.trim() || null,
          bank_ifsc_code: bankIfscCode.trim().toUpperCase() || null,
          bank_branch: bankBranch.trim() || null,
          bank_account_holder: bankAccountHolder.trim() || null,
          pan_number: panNumber.trim().toUpperCase() || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          marital_status: maritalStatus || null,
          blood_group: bloodGroup || null,
          nationality: nationality.trim() || null,
          current_address: currentAddress.trim() || null,
          permanent_address: permanentAddress.trim() || null,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_phone: emergencyContactPhone.trim() || null,
          emergency_contact_relation: emergencyContactRelation.trim() || null,
        })
        .eq("id", session.employeeId);

      if (error) throw error;

      // Automatically mark bank/personal tasks as submitted if present
      const personalTask = tasks.find(
        (t) => t.category === "personal_info" && t.status === "pending"
      );
      if (personalTask) {
        await supabase
          .from("employee_onboarding_tasks")
          .update({ status: "submitted" })
          .eq("id", personalTask.id);
      }

      const bankTask = tasks.find(
        (t) => t.category === "bank_details" && t.status === "pending"
      );
      if (bankTask) {
        await supabase
          .from("employee_onboarding_tasks")
          .update({ status: "submitted" })
          .eq("id", bankTask.id);
      }

      await supabase.rpc("recalculate_onboarding_progress", {
        p_onboarding_id: onboarding.id,
      });

      toast.success("Joining & bank details submitted successfully!");
      refetch();
      refetchTasks();
    } catch (err: any) {
      toast.error(err.message || "Failed to update details");
    } finally {
      setIsSavingForm(false);
    }
  };

  // When a document is uploaded for a task
  const handleDocumentUploaded = async () => {
    if (!activeTaskForUpload || !session.employeeId) return;

    // Find the latest document uploaded for this employee
    const { data: latestDoc } = await supabase
      .from("documents")
      .select("id")
      .eq("employee_id", session.employeeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDoc) {
      await supabase
        .from("employee_onboarding_tasks")
        .update({
          document_id: latestDoc.id,
          status: "submitted",
        })
        .eq("id", activeTaskForUpload.id);

      await supabase.rpc("recalculate_onboarding_progress", {
        p_onboarding_id: onboarding.id,
      });

      refetch();
      refetchTasks();
    }
    setActiveTaskForUpload(null);
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Welcome Banner */}
      <Card className="bg-card border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">
                Welcome to FlowPeople Onboarding!
              </h3>
              <Badge variant="outline" className={statusBadge.colorClass}>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Please complete your joining checklist, verify your bank account details, and upload mandatory identification documents.
            </p>
          </div>

          <div className="w-full sm:w-48 space-y-1.5 shrink-0">
            <div className="flex justify-between text-xs font-semibold">
              <span>Overall Progress</span>
              <span>{onboarding.progress_percentage}%</span>
            </div>
            <Progress value={onboarding.progress_percentage} className="h-2" />
          </div>
        </div>
      </Card>

      {/* Task Checklist Section */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span>Your Joining Checklist</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Submit each required step to finalize your onboarding.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-3">
          {tasks.map((task) => {
            const catBadge = getTaskCategoryBadge(task.category);
            const isCompleted =
              task.status === "verified" || task.status === "completed";
            const isSubmitted = task.status === "submitted";

            return (
              <div
                key={task.id}
                className={`p-4 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : isSubmitted
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-card"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {task.title}
                    </span>
                    <Badge variant="outline" className={catBadge.colorClass + " text-[10px]"}>
                      {catBadge.label}
                    </Badge>
                    {task.required && (
                      <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/10">
                        Required
                      </Badge>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}

                  {task.documents && (
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="text-muted-foreground">Attached Document:</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary gap-1 font-medium"
                        onClick={() => {
                          setPreviewDoc(task.documents as any);
                          setPreviewOpen(true);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {task.documents.title}
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCompleted ? (
                    <Badge className="bg-emerald-500 text-white gap-1 text-xs py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </Badge>
                  ) : isSubmitted ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-xs py-1">
                      Under Review
                    </Badge>
                  ) : task.category === "document" ? (
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => {
                        setActiveTaskForUpload(task);
                        setUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Document
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Fill details below
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Joining Forms & Bank Details Form */}
      <form onSubmit={handleSaveForm} className="space-y-6">
        {/* Bank & Tax Details */}
        <Card>
          <CardHeader className="p-4 sm:p-5 pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>Bank & Tax Credentials</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Direct deposit details for monthly salary disbursement and payroll processing.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ss-bank-holder">Account Holder Name *</Label>
                <Input
                  id="ss-bank-holder"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="Full name as printed on bank passbook"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-bank-name">Bank Name *</Label>
                <Input
                  id="ss-bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank, Chase"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-bank-acc">Account Number *</Label>
                <Input
                  id="ss-bank-acc"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Enter your bank account number"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-bank-ifsc">IFSC / Routing Code *</Label>
                <Input
                  id="ss-bank-ifsc"
                  value={bankIfscCode}
                  onChange={(e) => setBankIfscCode(e.target.value)}
                  placeholder="e.g. HDFC0001234"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-bank-branch">Branch City / Name</Label>
                <Input
                  id="ss-bank-branch"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Branch location"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-pan-num">PAN / National Tax ID *</Label>
                <Input
                  id="ss-pan-num"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  placeholder="e.g. ABCDE1234F"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Demographics */}
        <Card>
          <CardHeader className="p-4 sm:p-5 pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <span>Personal & Emergency Details</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Verify your residential address and emergency contact information.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ss-dob">Date of Birth</Label>
                <Input
                  id="ss-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-gender">Gender</Label>
                <Input
                  id="ss-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female, Male"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-blood">Blood Group</Label>
                <Input
                  id="ss-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  placeholder="e.g. O+, B+, A+"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ss-cur-addr">Current Address</Label>
                <Textarea
                  id="ss-cur-addr"
                  rows={2}
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  placeholder="Current living address..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-perm-addr">Permanent Address</Label>
                <Textarea
                  id="ss-perm-addr"
                  rows={2}
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Permanent native address..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="ss-em-name">Emergency Contact Name</Label>
                <Input
                  id="ss-em-name"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Contact person"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-em-phone">Emergency Phone</Label>
                <Input
                  id="ss-em-phone"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ss-em-rel">Relationship</Label>
                <Input
                  id="ss-em-rel"
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isSavingForm} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {isSavingForm ? "Submitting..." : "Save & Submit Details"}
          </Button>
        </div>
      </form>

      {/* Upload dialog when employee uploads for a task */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        fixedEmployeeId={session.employeeId}
        defaultCategory={
          activeTaskForUpload?.category === "document"
            ? "ID_DOC"
            : "OTHER"
        }
        onSuccess={handleDocumentUploaded}
      />

      {/* Preview modal */}
      <DocumentPreviewModal
        document={previewDoc}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
