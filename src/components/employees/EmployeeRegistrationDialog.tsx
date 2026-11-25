import { useState, useEffect } from "react";
import { UserPlus, User, Briefcase, Heart, MapPin, Shield, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface EmployeeRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: string[];
  existingEmployees: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  onSuccess: () => void;
}

export function EmployeeRegistrationDialog({
  open,
  onOpenChange,
  departments,
  existingEmployees,
  shifts,
  onSuccess,
}: EmployeeRegistrationDialogProps) {
  const [activeTab, setActiveTab] = useState("identity");
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Account & Identity
    full_name: "",
    email: "",
    password: "",
    employee_code: "",
    phone: "",
    personal_email: "",

    // Employment
    department: "General",
    new_department: "",
    designation: "Software Engineer",
    manager_id: "none",
    joining_date: new Date().toISOString().split("T")[0],
    employment_type: "full_time",
    work_location: "onsite",
    shift_id: "none",
    notice_period_days: "30",

    // Personal & Demographics
    gender: "male",
    date_of_birth: "",
    blood_group: "O+",
    marital_status: "single",
    nationality: "Indian",
    current_address: "",
    permanent_address: "",

    // Emergency Contacts
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "Spouse",
  });

  // Auto-generate employee code suggestion on open
  useEffect(() => {
    if (open && !formData.employee_code) {
      const randomSeq = Math.floor(100 + Math.random() * 900);
      setFormData((prev) => ({
        ...prev,
        employee_code: `EMP${randomSeq}`,
        password: "",
      }));
    }
  }, [open]);

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      setActiveTab("identity");
      toast.error("Full Name is required");
      return;
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setActiveTab("identity");
      toast.error("Valid work email address is required");
      return;
    }

    if (!formData.password || formData.password.trim().length < 6) {
      setActiveTab("identity");
      toast.error("Password must be at least 6 characters for login");
      return;
    }

    setSubmitting(true);
    try {
      const finalDept =
        formData.department === "NEW" && formData.new_department.trim()
          ? formData.new_department.trim()
          : formData.department;

      const finalManagerId = formData.manager_id === "none" ? null : formData.manager_id;
      const finalShiftId = formData.shift_id === "none" ? null : formData.shift_id;

      // 1. Call admin_create_employee_v2 RPC
      const { data, error } = await (supabase.rpc as any)("admin_create_employee_v2", {
        p_email: formData.email.trim().toLowerCase(),
        p_password: formData.password.trim(),
        p_full_name: formData.full_name.trim(),
        p_department: finalDept,
        p_designation: formData.designation.trim() || "Employee",
        p_phone: formData.phone.trim() || null,
        p_person_code: formData.employee_code.trim() || null,
        p_manager_id: finalManagerId,
        p_joining_date: formData.joining_date || null,
        p_employment_type: formData.employment_type,
        p_work_location: formData.work_location,
        p_shift_id: finalShiftId,
        p_personal_email: formData.personal_email.trim() || null,
        p_gender: formData.gender,
        p_date_of_birth: formData.date_of_birth || null,
        p_blood_group: formData.blood_group || null,
        p_marital_status: formData.marital_status || null,
        p_current_address: formData.current_address.trim() || null,
        p_permanent_address: formData.permanent_address.trim() || null,
        p_emergency_contact_name: formData.emergency_contact_name.trim() || null,
        p_emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        p_emergency_contact_relation: formData.emergency_contact_relation || null,
      });

      if (error) {
        // Fallback to legacy RPC if v2 not yet applied
        const { error: legacyErr } = await (supabase.rpc as any)("admin_create_employee", {
          p_email: formData.email.trim().toLowerCase(),
          p_password: formData.password.trim(),
          p_full_name: formData.full_name.trim(),
          p_department: finalDept,
          p_phone: formData.phone.trim() || null,
          p_person_code: formData.employee_code.trim() || null,
        });
        if (legacyErr) throw legacyErr;
      }

      toast.success(`Employee ${formData.full_name} registered successfully!`, {
        description: `Login email: ${formData.email} • ID: ${formData.employee_code}`,
      });

      onSuccess();
      onOpenChange(false);

      // Reset form
      setFormData({
        full_name: "",
        email: "",
        password: "",
        employee_code: "",
        phone: "",
        personal_email: "",
        department: "General",
        new_department: "",
        designation: "Software Engineer",
        manager_id: "none",
        joining_date: new Date().toISOString().split("T")[0],
        employment_type: "full_time",
        work_location: "onsite",
        shift_id: "none",
        notice_period_days: "30",
        gender: "male",
        date_of_birth: "",
        blood_group: "O+",
        marital_status: "single",
        nationality: "Indian",
        current_address: "",
        permanent_address: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relation: "Spouse",
      });
      setActiveTab("identity");
    } catch (err: any) {
      toast.error(err.message || "Failed to register employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <UserPlus className="h-5 w-5 text-primary" />
            Register New Employee
          </DialogTitle>
          <DialogDescription>
            Onboard a new employee with unique employee code, department, role, and login credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="identity" className="text-xs gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Identity & Login</span>
                <span className="sm:hidden">Identity</span>
              </TabsTrigger>
              <TabsTrigger value="employment" className="text-xs gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                <span>Employment</span>
              </TabsTrigger>
              <TabsTrigger value="personal" className="text-xs gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>Personal</span>
              </TabsTrigger>
              <TabsTrigger value="emergency" className="text-xs gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                <span>Emergency</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 py-1 space-y-4">
              {/* TAB 1: IDENTITY & LOGIN */}
              <TabsContent value="identity" className="space-y-4 m-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name" className="text-xs font-semibold">
                      Full Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. Priya Sharma"
                      value={formData.full_name}
                      onChange={(e) => handleChange("full_name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="employee_code" className="text-xs font-semibold">
                      Unique Employee ID <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="employee_code"
                      placeholder="e.g. EMP005"
                      value={formData.employee_code}
                      onChange={(e) => handleChange("employee_code", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Corporate Work Email <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="priya@company.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold">
                      Initial Login Password <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="text"
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium">
                      Mobile Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="personal_email" className="text-xs font-medium">
                      Personal Email
                    </Label>
                    <Input
                      id="personal_email"
                      type="email"
                      placeholder="priya.personal@gmail.com"
                      value={formData.personal_email}
                      onChange={(e) => handleChange("personal_email", e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: EMPLOYMENT */}
              <TabsContent value="employment" className="space-y-4 m-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Department</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(val) => handleChange("department", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                        <SelectItem value="NEW">+ Add New Department</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.department === "NEW" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="new_dept" className="text-xs font-semibold">
                        New Department Name
                      </Label>
                      <Input
                        id="new_dept"
                        placeholder="e.g. Artificial Intelligence"
                        value={formData.new_department}
                        onChange={(e) => handleChange("new_department", e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="designation" className="text-xs font-semibold">
                      Designation / Job Title
                    </Label>
                    <Input
                      id="designation"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={formData.designation}
                      onChange={(e) => handleChange("designation", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Reporting Manager</Label>
                    <Select
                      value={formData.manager_id}
                      onValueChange={(val) => handleChange("manager_id", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Direct Report / Executive)</SelectItem>
                        {existingEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="joining_date" className="text-xs font-semibold">
                      Joining Date
                    </Label>
                    <Input
                      id="joining_date"
                      type="date"
                      value={formData.joining_date}
                      onChange={(e) => handleChange("joining_date", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employment Type</Label>
                    <Select
                      value={formData.employment_type}
                      onValueChange={(val) => handleChange("employment_type", val)}
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
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Work Location</Label>
                    <Select
                      value={formData.work_location}
                      onValueChange={(val) => handleChange("work_location", val)}
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
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Assigned Shift</Label>
                    <Select
                      value={formData.shift_id}
                      onValueChange={(val) => handleChange("shift_id", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Standard Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General (9 AM - 6 PM)</SelectItem>
                        {shifts.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: PERSONAL */}
              <TabsContent value="personal" className="space-y-4 m-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date_of_birth" className="text-xs font-medium">
                      Date of Birth
                    </Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(val) => handleChange("gender", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-Binary</SelectItem>
                        <SelectItem value="other">Other / Decline to State</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Blood Group</Label>
                    <Select
                      value={formData.blood_group}
                      onValueChange={(val) => handleChange("blood_group", val)}
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
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Marital Status</Label>
                    <Select
                      value={formData.marital_status}
                      onValueChange={(val) => handleChange("marital_status", val)}
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
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nationality" className="text-xs font-medium">
                      Nationality
                    </Label>
                    <Input
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => handleChange("nationality", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="current_address" className="text-xs font-medium">
                    Current Residential Address
                  </Label>
                  <Textarea
                    id="current_address"
                    rows={2}
                    placeholder="Street, City, State, PIN Code"
                    value={formData.current_address}
                    onChange={(e) => handleChange("current_address", e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* TAB 4: EMERGENCY CONTACT */}
              <TabsContent value="emergency" className="space-y-4 m-0">
                <div className="rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/30 p-3 text-xs text-rose-800 dark:text-rose-300">
                  Emergency contact information is securely stored for workplace safety and urgent personnel notifications.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emergency_name" className="text-xs font-semibold">
                    Emergency Contact Full Name
                  </Label>
                  <Input
                    id="emergency_name"
                    placeholder="e.g. Ramesh Sharma"
                    value={formData.emergency_contact_name}
                    onChange={(e) => handleChange("emergency_contact_name", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Relationship</Label>
                    <Select
                      value={formData.emergency_contact_relation}
                      onValueChange={(val) => handleChange("emergency_contact_relation", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Spouse", "Parent", "Sibling", "Child", "Friend", "Guardian", "Other"].map(
                          (rel) => (
                            <SelectItem key={rel} value={rel}>
                              {rel}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="emergency_phone" className="text-xs font-semibold">
                      Emergency Phone Number
                    </Label>
                    <Input
                      id="emergency_phone"
                      type="tel"
                      placeholder="+91 98765 00000"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handleChange("emergency_contact_phone", e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Complete Registration</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
