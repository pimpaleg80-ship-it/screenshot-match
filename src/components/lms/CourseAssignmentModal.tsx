import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LmsCourse } from "@/lib/performance-lms";
import { Users, Calendar, Award, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CourseAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: LmsCourse | null;
}

export function CourseAssignmentModal({
  open,
  onOpenChange,
  course,
}: CourseAssignmentModalProps) {
  const queryClient = useQueryClient();

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["assignable-lms-employees"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, department_id, departments(name)")
        .eq("status", "active")
        .order("full_name");
      if (error) return [];
      return data ?? [];
    },
  });

  const toggleEmployee = (empId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const selectAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e: any) => e.id));
    }
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!course) return;
      if (selectedEmployeeIds.length === 0) {
        throw new Error("Please select at least one employee");
      }

      const { data, error } = await supabase.rpc("assign_course_to_employees", {
        p_course_id: course.id,
        p_employee_ids: selectedEmployeeIds,
        p_due_date: dueDate || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (count: any) => {
      toast.success(`Assigned course to ${count || selectedEmployeeIds.length} employee(s)`);
      queryClient.invalidateQueries({ queryKey: ["lms-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["lms-courses"] });
      onOpenChange(false);
      setSelectedEmployeeIds([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign course");
    },
  });

  if (!course) return null;

  const filteredEmployees = employees.filter((e: any) =>
    e.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.departments?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            <span>Assign Training Course</span>
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{course.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Due date picker */}
          <div className="space-y-1.5">
            <Label htmlFor="assign-due">Completion Deadline / Due Date</Label>
            <Input
              id="assign-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Search employees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Target Employees ({selectedEmployeeIds.length} selected)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary"
                onClick={selectAll}
              >
                {selectedEmployeeIds.length === filteredEmployees.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <Input
              placeholder="Search by name, employee ID, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs"
            />

            {/* Employee Checkbox List */}
            <div className="border border-border rounded-lg max-h-56 overflow-y-auto p-2 space-y-1 bg-muted/20">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No matching employees found.
                </p>
              ) : (
                filteredEmployees.map((emp: any) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{emp.full_name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {emp.employee_code} • {emp.departments?.name || "General"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {emp.designation || "Employee"}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending || selectedEmployeeIds.length === 0}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {assignMutation.isPending
                ? "Assigning..."
                : `Assign to ${selectedEmployeeIds.length} Employee(s)`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
