import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Briefcase,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Candidate } from "@/lib/recruitment";

interface ConvertCandidateModalProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (employeeId: string) => void;
}

export function ConvertCandidateModal({
  candidate,
  open,
  onOpenChange,
  onSuccess,
}: ConvertCandidateModalProps) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [joiningDate, setJoiningDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0] ?? "";
  });
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");
  const [managerId, setManagerId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [startOnboarding, setStartOnboarding] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if an employee with this candidate's email already exists
  const { data: existingEmployee, isLoading: checkingDuplicate } = useQuery({
    queryKey: ["check-duplicate-employee", candidate?.email],
    enabled: open && Boolean(candidate?.email),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, email, designation")
        .ilike("email", candidate!.email.trim())
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  // Load departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-convert-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load employees for manager selection
  const { data: managers = [] } = useQuery({
    queryKey: ["managers-convert-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-convert-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, name, start_time, end_time")
        .order("name", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // Generate a recommended employee code on open
  useEffect(() => {
    if (!open || !candidate) return;

    // Default designation from candidate or job opening
    setDesignation(
      candidate.job_openings?.title ||
        candidate.current_designation ||
        "Software Engineer"
    );

    if (candidate.job_openings?.department_id) {
      setDepartmentId(candidate.job_openings.department_id);
    } else if (departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0]?.id ?? "");
    }

    if (candidate.joining_date) {
      setJoiningDate(candidate.joining_date);
    }

    // Auto-generate next employee code
    supabase
      .from("employees")
      .select("employee_code")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.employee_code) {
          const match = data.employee_code.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10) + 1;
            setEmployeeCode(`EMP-${String(num).padStart(3, "0")}`);
            return;
          }
        }
        setEmployeeCode(`EMP-${Math.floor(100 + Math.random() * 900)}`);
      });
  }, [open, candidate, departments]);

  if (!candidate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim() && !existingEmployee) {
      toast.error("Please enter a valid employee code");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: newEmpId, error } = await supabase.rpc(
        "convert_candidate_to_employee",
        {
          p_candidate_id: candidate.id,
          p_employee_code: existingEmployee?.employee_code || employeeCode.trim().toUpperCase() || "EMP-001",
          p_joining_date: joiningDate || new Date().toISOString().slice(0, 10),
          p_designation: designation.trim() || null,
          p_department_id: departmentId || null,
          p_manager_id: managerId || null,
          p_employment_type: employmentType,
          p_shift_id: shiftId || null,
          p_start_onboarding: startOnboarding,
        }
      );

      if (error) throw error;

      toast.success(
        existingEmployee
          ? `Candidate successfully linked to existing employee profile (${existingEmployee.employee_code})`
          : `Candidate successfully converted to Employee (${employeeCode})!`
      );

      onSuccess(newEmpId || existingEmployee?.id || "");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Conversion error:", err);
      toast.error(err.message || "Failed to convert candidate to employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>Convert Candidate to Official Employee</span>
          </DialogTitle>
          <DialogDescription>
            Create an employee record for{" "}
            <span className="font-semibold text-foreground">
              {candidate.full_name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {/* Duplicate Detection Alert */}
        {existingEmployee && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Existing Employee Record Detected ({existingEmployee.employee_code})
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                An active employee profile with email <strong>{candidate.email}</strong>{" "}
                is already in FlowPeople. Converting will link this candidate record without creating a duplicate profile.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Employee Code & Joining Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="conv-code">Official Employee Code *</Label>
              <Input
                id="conv-code"
                value={existingEmployee?.employee_code || employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                disabled={Boolean(existingEmployee)}
                placeholder="e.g. EMP-025"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv-date">Effective Joining Date *</Label>
              <Input
                id="conv-date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Designation & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="conv-desig">Designation / Role *</Label>
              <Input
                id="conv-desig"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reporting Manager & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Reporting Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reporting manager..." />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {managers.map((mgr) => (
                    <SelectItem key={mgr.id} value={mgr.id}>
                      {mgr.full_name} ({mgr.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned Shift Roster</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift..." />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time} - {s.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Employment Type */}
          <div className="space-y-1.5">
            <Label>Employment Type</Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contractor</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  Trigger Employee Onboarding Pipeline
                </Label>
                <p className="text-xs text-muted-foreground">
                  Initializes onboarding checklist, personal info forms, bank credentials & document collection
                </p>
              </div>
              <Switch
                checked={startOnboarding}
                onCheckedChange={setStartOnboarding}
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting
                ? "Converting..."
                : existingEmployee
                ? "Link & Activate Employee"
                : "Convert to Official Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
