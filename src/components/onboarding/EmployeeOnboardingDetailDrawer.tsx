import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  User,
  CreditCard,
  Briefcase,
  ShieldCheck,
  ExternalLink,
  Upload,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EmployeeOnboardingRecord,
  EmployeeOnboardingTask,
  getOnboardingStatusBadge,
  getTaskCategoryBadge,
} from "@/lib/onboarding";
import { formatDate } from "@/lib/attendance";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentItem } from "@/lib/documents";

interface EmployeeOnboardingDetailDrawerProps {
  onboarding: EmployeeOnboardingRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EmployeeOnboardingDetailDrawer({
  onboarding,
  open,
  onOpenChange,
  onSuccess,
}: EmployeeOnboardingDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "form" | "agreements" | "review">("tasks");
  const [tasks, setTasks] = useState<EmployeeOnboardingTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form editable states
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

  const [hrNotes, setHrNotes] = useState("");

  // Preview modal for attached docs
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch tasks and employee joining details when drawer opens
  useEffect(() => {
    if (!open || !onboarding) return;

    setHrNotes(onboarding.hr_notes || "");

    const loadData = async () => {
      setLoadingTasks(true);
      try {
        // Load tasks with joined document details
        const { data: taskData, error: taskErr } = await supabase
          .from("employee_onboarding_tasks")
          .select(`
            *,
            documents:document_id (
              id,
              title,
              file_url,
              file_name,
              category,
              verification_status
            )
          `)
          .eq("onboarding_id", onboarding.id)
          .order("order_index", { ascending: true });

        if (taskErr) throw taskErr;
        setTasks((taskData ?? []) as any[]);

        // Load employee full details
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("*")
          .eq("id", onboarding.employee_id)
          .single();

        if (!empErr && empData) {
          setBankName(empData.bank_name || "");
          setBankAccountNumber(empData.bank_account_number || "");
          setBankIfscCode(empData.bank_ifsc_code || "");
          setBankBranch(empData.bank_branch || "");
          setBankAccountHolder(empData.bank_account_holder || empData.full_name || "");
          setPanNumber(empData.pan_number || "");

          setDateOfBirth(empData.date_of_birth || "");
          setGender(empData.gender || "");
          setMaritalStatus(empData.marital_status || "");
          setBloodGroup(empData.blood_group || "");
          setNationality(empData.nationality || "");
          setCurrentAddress(empData.current_address || "");
          setPermanentAddress(empData.permanent_address || "");
          setEmergencyContactName(empData.emergency_contact_name || "");
          setEmergencyContactPhone(empData.emergency_contact_phone || "");
          setEmergencyContactRelation(empData.emergency_contact_relation || "");
        }
      } catch (err: any) {
        console.error("Failed to load onboarding details:", err);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadData();
  }, [open, onboarding]);

  if (!onboarding) return null;

  const statusBadge = getOnboardingStatusBadge(onboarding.status);

  // Save joining and bank details
  const handleSaveJoiningForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
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
        .eq("id", onboarding.employee_id);

      if (error) throw error;

      toast.success("Candidate personal & bank details saved");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update employee details");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle individual task verification
  const handleToggleTaskStatus = async (task: EmployeeOnboardingTask, newStatus: string) => {
    try {
      const { data: userAuth } = await supabase.auth.getUser();
      const currentUserId = userAuth?.user?.id ?? null;

      const { error } = await supabase
        .from("employee_onboarding_tasks")
        .update({
          status: newStatus,
          completed_by: newStatus === "verified" || newStatus === "completed" ? currentUserId : null,
          completed_at: newStatus === "verified" || newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", task.id);

      if (error) throw error;

      // Recalculate onboarding progress
      const { data: newPct } = await supabase.rpc("recalculate_onboarding_progress", {
        p_onboarding_id: onboarding.id,
      });

      // Update local state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: newStatus }
            : t
        )
      );

      toast.success(`Task marked as ${newStatus}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  };

  // Complete Onboarding & Activate Employee
  const handleCompleteOnboarding = async () => {
    if (!confirm("Are you sure you want to complete onboarding? This will officially activate the employee and allocate their annual leave balances.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("complete_employee_onboarding", {
        p_onboarding_id: onboarding.id,
        p_hr_notes: hrNotes.trim() || null,
      });

      if (error) throw error;

      toast.success("Employee successfully onboarded and activated!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Complete onboarding error:", err);
      toast.error(err.message || "Failed to complete onboarding");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col h-full bg-background border-l shadow-2xl">
        {/* Drawer Header */}
        <SheetHeader className="p-5 border-b bg-card/60 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{onboarding.employees?.full_name}</span>
                  <Badge variant="outline" className={statusBadge.colorClass}>
                    {statusBadge.label}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono">{onboarding.employees?.employee_code}</span>
                  <span>•</span>
                  <span>{onboarding.employees?.designation || "Designation Pending"}</span>
                  {onboarding.employees?.departments?.name && (
                    <>
                      <span>•</span>
                      <span>{onboarding.employees.departments.name}</span>
                    </>
                  )}
                </SheetDescription>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold text-foreground">
                {onboarding.progress_percentage}% Done
              </div>
              <Progress
                value={onboarding.progress_percentage}
                className="w-28 h-2 mt-1.5"
              />
            </div>
          </div>
        </SheetHeader>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-5 pt-3 border-b bg-muted/20">
            <TabsList className="grid grid-cols-4 max-w-xl h-9 text-xs">
              <TabsTrigger value="tasks">Checklist</TabsTrigger>
              <TabsTrigger value="form">Joining Details</TabsTrigger>
              <TabsTrigger value="agreements">Agreements</TabsTrigger>
              <TabsTrigger value="review">HR Review</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: CHECKLIST & TASKS */}
            <TabsContent value="tasks" className="m-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    Onboarding Tasks & Milestones
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Required documents, identity verification, IT configuration, and welcome procedures.
                  </p>
                </div>
              </div>

              {loadingTasks ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading onboarding tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center bg-card rounded-lg border space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold">No tasks configured</p>
                  <p className="text-xs text-muted-foreground">
                    This onboarding record does not have any checklist items assigned.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const catBadge = getTaskCategoryBadge(task.category);
                    const isDone =
                      task.status === "verified" || task.status === "completed";

                    return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDone
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-card hover:border-border/80"
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

                          {/* Attached document link if any */}
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

                        {/* Task Action Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isDone ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 px-2.5 py-1 text-xs">
                              <Check className="w-3.5 h-3.5" />
                              Completed
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400 gap-1"
                                onClick={() => handleToggleTaskStatus(task, "verified")}
                              >
                                <Check className="w-3.5 h-3.5" />
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-muted-foreground hover:bg-muted"
                                onClick={() => handleToggleTaskStatus(task, "completed")}
                              >
                                Mark Done
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: JOINING FORMS & BANK DETAILS */}
            <TabsContent value="form" className="m-0 space-y-6">
              <form onSubmit={handleSaveJoiningForm} className="space-y-6">
                {/* Bank Details Section */}
                <div className="bg-card rounded-lg border p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Bank & Payroll Credentials
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Account details for salary disbursement and statutory tax records.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank-holder">Account Holder Name</Label>
                      <Input
                        id="bank-holder"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        placeholder="As per bank passbook"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bank-name">Bank Name</Label>
                      <Input
                        id="bank-name"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank, ICICI Bank, Chase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bank-acc">Account Number</Label>
                      <Input
                        id="bank-acc"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="Enter account number"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bank-ifsc">IFSC / Routing Code</Label>
                      <Input
                        id="bank-ifsc"
                        value={bankIfscCode}
                        onChange={(e) => setBankIfscCode(e.target.value)}
                        placeholder="e.g. HDFC0001234"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bank-branch">Branch Name</Label>
                      <Input
                        id="bank-branch"
                        value={bankBranch}
                        onChange={(e) => setBankBranch(e.target.value)}
                        placeholder="Branch city / location"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pan-num">PAN / Tax ID</Label>
                      <Input
                        id="pan-num"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value)}
                        placeholder="e.g. ABCDE1234F"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Information Section */}
                <div className="bg-card rounded-lg border p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <User className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Personal Background Details
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Demographic details and physical residence addresses.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gender">Gender</Label>
                      <Input
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        placeholder="e.g. Female, Male, Non-binary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="blood">Blood Group</Label>
                      <Input
                        id="blood"
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        placeholder="e.g. O+, B+, A-"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="marital">Marital Status</Label>
                      <Input
                        id="marital"
                        value={maritalStatus}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        placeholder="Single, Married, etc."
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="nationality">Nationality</Label>
                      <Input
                        id="nationality"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="e.g. Indian, American, British"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cur-addr">Current Residential Address</Label>
                      <Textarea
                        id="cur-addr"
                        rows={2}
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        placeholder="Current living address..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="perm-addr">Permanent Address</Label>
                      <Textarea
                        id="perm-addr"
                        rows={2}
                        value={permanentAddress}
                        onChange={(e) => setPermanentAddress(e.target.value)}
                        placeholder="Permanent native address..."
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="bg-card rounded-lg border p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Emergency Contact
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Designated contact person in case of urgent workplace situations.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="em-name">Contact Full Name</Label>
                      <Input
                        id="em-name"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        placeholder="Contact name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="em-phone">Phone Number</Label>
                      <Input
                        id="em-phone"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="em-rel">Relationship</Label>
                      <Input
                        id="em-rel"
                        value={emergencyContactRelation}
                        onChange={(e) => setEmergencyContactRelation(e.target.value)}
                        placeholder="e.g. Spouse, Parent, Sibling"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Joining Information"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* TAB 3: AGREEMENTS & OFFER LETTER */}
            <TabsContent value="agreements" className="m-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Offer Letter Card */}
                <div className="bg-card rounded-lg border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold text-sm">Official Offer Letter</h4>
                    </div>
                    {onboarding.offer_letter_accepted_at ? (
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        Accepted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                        Pending Sign
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formal job offer outlining compensation, joining date, and position terms.
                  </p>
                  {onboarding.offer_letter_accepted_at && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Accepted on {formatDate(onboarding.offer_letter_accepted_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Employment Agreement Card */}
                <div className="bg-card rounded-lg border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold text-sm">Employment Agreement</h4>
                    </div>
                    {onboarding.employment_agreement_accepted_at ? (
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        Executed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                        Pending Sign
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Legally binding employment contract covering IP assignment, NDA, and code of conduct.
                  </p>
                  {onboarding.employment_agreement_accepted_at && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Executed on {formatDate(onboarding.employment_agreement_accepted_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: HR REVIEW & FINAL COMPLETION */}
            <TabsContent value="review" className="m-0 space-y-6">
              <div className="bg-card rounded-lg border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">
                      HR Verification & Final Sign-Off
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Review all submitted documentation, verify bank and tax records, and activate the employee profile.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hr-notes">HR Auditor Notes / Remarks</Label>
                  <Textarea
                    id="hr-notes"
                    rows={3}
                    value={hrNotes}
                    onChange={(e) => setHrNotes(e.target.value)}
                    placeholder="Enter compliance notes, audit observations, or comments..."
                  />
                </div>

                <div className="p-4 rounded-lg bg-muted/40 border space-y-2">
                  <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Automatic Actions Upon Completion
                  </h5>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Marks onboarding status as <strong>Completed</strong>.</li>
                    <li>Upgrades employee status to <strong>Active</strong>.</li>
                    <li>Automatically provisions annual leave balances (Casual, Sick, Earned).</li>
                    <li>Grants full Self-Service access to employee dashboard.</li>
                  </ul>
                </div>

                <Button
                  onClick={handleCompleteOnboarding}
                  disabled={isSubmitting || onboarding.status === "completed"}
                  className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {onboarding.status === "completed"
                    ? "Onboarding Already Completed"
                    : isSubmitting
                    ? "Completing Onboarding..."
                    : "Complete Onboarding & Activate Employee"}
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>

      {/* Document preview modal if user clicks on attached document */}
      <DocumentPreviewModal
        document={previewDoc}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Sheet>
  );
}
