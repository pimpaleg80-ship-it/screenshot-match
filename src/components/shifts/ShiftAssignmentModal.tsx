import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Building2,
  Clock,
  Calendar,
  CheckCircle2,
  Loader2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { toDateKey } from "@/lib/attendance";

interface ShiftAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultShiftId?: string | null;
}

export function ShiftAssignmentModal({
  open,
  onOpenChange,
  defaultShiftId,
}: ShiftAssignmentModalProps) {
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [targetType, setTargetType] = useState<"employee" | "department">("employee");
  const [selectedShiftId, setSelectedShiftId] = useState<string>(defaultShiftId || "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [startDate, setStartDate] = useState(todayKey);
  const [notes, setNotes] = useState("");

  // Query shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, name, code, start_time, end_time, color")
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Query employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-shift-assign-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, department_id, departments(name)")
        .eq("status", "active")
        .neq("is_superadmin", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Query departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-shift-assign-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const shiftId = selectedShiftId || defaultShiftId;
      if (!shiftId) throw new Error("Please select a target shift");

      if (targetType === "employee") {
        if (!selectedEmployeeId) throw new Error("Please select an employee");

        // 1. Update employee's active shift_id
        const { error: empErr } = await supabase
          .from("employees")
          .update({ shift_id: shiftId, updated_at: new Date().toISOString() })
          .eq("id", selectedEmployeeId);
        if (empErr) throw empErr;

        // 2. Insert shift assignment record
        const { error: assignErr } = await supabase.from("shift_assignments").insert({
          shift_id: shiftId,
          employee_id: selectedEmployeeId,
          start_date: startDate,
          notes: notes.trim() || null,
        });
        if (assignErr) throw assignErr;
      } else {
        // Department assignment
        if (!selectedDepartmentId) throw new Error("Please select a department");

        // 1. Bulk update all employees in this department
        const { error: bulkErr } = await supabase
          .from("employees")
          .update({ shift_id: shiftId, updated_at: new Date().toISOString() })
          .eq("department_id", selectedDepartmentId);
        if (bulkErr) throw bulkErr;

        // 2. Insert department-level assignment record
        const { error: assignErr } = await supabase.from("shift_assignments").insert({
          shift_id: shiftId,
          department_id: selectedDepartmentId,
          start_date: startDate,
          notes: notes.trim() || null,
        });
        if (assignErr) throw assignErr;
      }
    },
    onSuccess: () => {
      toast.success(
        targetType === "employee"
          ? "Shift assigned to employee successfully"
          : "Shift assigned to all employees in department"
      );
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["shifts-list-all"] });
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
      queryClient.invalidateQueries({ queryKey: ["employee-shift-counts"] });
      queryClient.invalidateQueries({ queryKey: ["my-shift-details"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign shift");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Shift Assignment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign standard or rotational shifts to individual employees or entire departments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Target Type Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Assignment Target</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={targetType === "employee" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("employee")}
                className="h-8 text-xs gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Individual Employee
              </Button>
              <Button
                type="button"
                variant={targetType === "department" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("department")}
                className="h-8 text-xs gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5" />
                Bulk Department
              </Button>
            </div>
          </div>

          {/* Shift Selection */}
          <div className="space-y-1">
            <Label className="text-xs">Shift Schedule</Label>
            <Select
              value={selectedShiftId || defaultShiftId || ""}
              onValueChange={setSelectedShiftId}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select shift schedule" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code}) — {s.start_time.slice(0, 5)} to {s.end_time.slice(0, 5)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Target Picker */}
          {targetType === "employee" ? (
            <div className="space-y-1">
              <Label className="text-xs">Select Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose active employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code}) — {e.departments?.name || "General"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Select Department</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose department to bulk assign" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} Department
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Effective Date */}
          <div className="space-y-1">
            <Label className="text-xs">Effective Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes / Reason (Optional)</Label>
            <Input
              placeholder="Optional notes or reason"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => assignMutation.mutate()}
            disabled={
              assignMutation.isPending ||
              (!selectedShiftId && !defaultShiftId) ||
              (targetType === "employee" ? !selectedEmployeeId : !selectedDepartmentId)
            }
            className="gap-1.5 text-xs h-8"
          >
            {assignMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
