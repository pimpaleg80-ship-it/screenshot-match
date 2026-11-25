import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Calendar, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { OnboardingTemplate } from "@/lib/onboarding";

interface NewEmployeeOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewEmployeeOnboardingModal({
  open,
  onOpenChange,
  onSuccess,
}: NewEmployeeOnboardingModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 2 weeks default
    return d.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load employees who do not have an active onboarding
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["unboarded-employees-list", open],
    enabled: open,
    queryFn: async () => {
      // First get existing active onboardings
      const { data: activeOnboardings } = await supabase
        .from("employee_onboarding")
        .select("employee_id")
        .neq("status", "cancelled");

      const activeEmpIds = (activeOnboardings ?? []).map((o) => o.employee_id);

      // Fetch employees
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, email, designation, department_id, departments:department_id(name)")
        .order("full_name", { ascending: true });

      if (error) throw error;
      const all = (data ?? []) as any[];

      // Prefer those not already in onboarding
      return all.filter((e) => !activeEmpIds.includes(e.id));
    },
  });

  // Load available onboarding templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["onboarding-templates-picker", open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_templates")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false });

      if (error) {
        console.warn("Could not load templates:", error.message);
        return [];
      }

      if (data && data.length > 0 && !templateId) {
        // default select the first or default template
        const def = data.find((t) => t.is_default) || data[0];
        if (def) setTemplateId(def.id);
      }
      return (data ?? []) as OnboardingTemplate[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Please select an employee to onboard");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call database procedure start_employee_onboarding
      const { data, error } = await supabase.rpc("start_employee_onboarding", {
        p_employee_id: employeeId,
        p_template_id: templateId || null,
        p_target_date: targetDate || null,
      });

      if (error) throw error;

      toast.success("Employee onboarding pipeline initiated successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to start onboarding:", err);
      toast.error(err.message || "Failed to initiate onboarding");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Initiate Employee Onboarding</span>
          </DialogTitle>
          <DialogDescription>
            Assign an onboarding checklist, track document verification, and coordinate joining forms.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Employee Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="employee-select">Select New Hire / Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee-select">
                <SelectValue placeholder="Choose employee..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {employees.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    {loadingEmployees
                      ? "Loading employees..."
                      : "All employees have already initiated onboarding"}
                  </div>
                ) : (
                  employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code})
                      {emp.departments?.name && ` • ${emp.departments.name}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="template-select">Onboarding Checklist Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Choose template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name} {tpl.is_default && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Initializes required documents, personal info forms, bank verification, and orientation steps.
            </p>
          </div>

          {/* Target Completion Date */}
          <div className="space-y-1.5">
            <Label htmlFor="target-date">Target Completion Date</Label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Default is 14 days from initiation.
            </p>
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
              disabled={isSubmitting || !employeeId}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? "Starting..." : "Start Onboarding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
