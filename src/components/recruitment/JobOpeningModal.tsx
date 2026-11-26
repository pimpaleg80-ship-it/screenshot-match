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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Building2, MapPin, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { JobOpening } from "@/lib/recruitment";

interface JobOpeningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  jobToEdit?: JobOpening | null;
}

export function JobOpeningModal({
  open,
  onOpenChange,
  onSuccess,
  jobToEdit,
}: JobOpeningModalProps) {
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [workplaceType, setWorkplaceType] = useState("hybrid");
  const [location, setLocation] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [openingsCount, setOpeningsCount] = useState("1");
  const [status, setStatus] = useState("published");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-picker-recruitment"],
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

  // Load hiring managers (employees)
  const { data: employees = [] } = useQuery({
    queryKey: ["hiring-managers-picker"],
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

  useEffect(() => {
    if (jobToEdit) {
      setTitle(jobToEdit.title || "");
      setDepartmentId(jobToEdit.department_id || "");
      setExperienceLevel(jobToEdit.experience_level || "mid");
      setEmploymentType(jobToEdit.employment_type || "full_time");
      setWorkplaceType(jobToEdit.workplace_type || "hybrid");
      setLocation(jobToEdit.location || "");
      setMinSalary(jobToEdit.min_salary ? String(jobToEdit.min_salary) : "");
      setMaxSalary(jobToEdit.max_salary ? String(jobToEdit.max_salary) : "");
      setOpeningsCount(jobToEdit.openings_count ? String(jobToEdit.openings_count) : "1");
      setStatus(jobToEdit.status || "published");
      setHiringManagerId(jobToEdit.hiring_manager_id || "");
      setDescription(jobToEdit.description || "");
    } else {
      setTitle("");
      setDepartmentId(departments[0]?.id || "");
      setExperienceLevel("mid");
      setEmploymentType("full_time");
      setWorkplaceType("hybrid");
      setLocation("Bengaluru, India");
      setMinSalary("");
      setMaxSalary("");
      setOpeningsCount("1");
      setStatus("published");
      setHiringManagerId("");
      setDescription("");
    }
  }, [jobToEdit, open, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a job title");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        department_id: departmentId || null,
        experience_level: experienceLevel,
        employment_type: employmentType,
        workplace_type: workplaceType,
        location: location.trim() || null,
        min_salary: minSalary ? Number(minSalary) : null,
        max_salary: maxSalary ? Number(maxSalary) : null,
        openings_count: Math.max(1, Number(openingsCount) || 1),
        status,
        hiring_manager_id: hiringManagerId || null,
        description: description.trim() || null,
      };

      if (jobToEdit) {
        const { error } = await supabase
          .from("job_openings")
          .update(payload)
          .eq("id", jobToEdit.id);
        if (error) throw error;
        toast.success("Job opening updated successfully");
      } else {
        const { error } = await supabase.from("job_openings").insert(payload);
        if (error) throw error;
        toast.success("Job opening published successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Job opening submit error:", err);
      toast.error(err.message || "Failed to save job opening");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <span>{jobToEdit ? "Edit Job Opening" : "Create New Job Opening"}</span>
          </DialogTitle>
          <DialogDescription>
            Enter job details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Job Title */}
          <div className="space-y-1.5">
            <Label htmlFor="job-title">Job Title *</Label>
            <Input
              id="job-title"
              placeholder="e.g. Senior Frontend Engineer, Talent Acquisition Manager"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Department & Experience Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-1.5">
              <Label>Experience Level</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry Level (0-2 yrs)</SelectItem>
                  <SelectItem value="mid">Mid Level (2-5 yrs)</SelectItem>
                  <SelectItem value="senior">Senior Level (5-8 yrs)</SelectItem>
                  <SelectItem value="lead">Lead / Principal (8+ yrs)</SelectItem>
                  <SelectItem value="executive">Director / Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Employment Type, Workplace & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Workplace Mode</Label>
              <Select value={workplaceType} onValueChange={setWorkplaceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">Onsite</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job-loc">Location / City</Label>
              <Input
                id="job-loc"
                placeholder="e.g. Bengaluru, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Salary Range & Openings Count */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="min-sal">Min Annual CTC (INR)</Label>
              <Input
                id="min-sal"
                type="number"
                placeholder="e.g. 1500000"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-sal">Max Annual CTC (INR)</Label>
              <Input
                id="max-sal"
                type="number"
                placeholder="e.g. 2500000"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="open-count">Positions / Headcount</Label>
              <Input
                id="open-count"
                type="number"
                min="1"
                value={openingsCount}
                onChange={(e) => setOpeningsCount(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Hiring Manager & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Hiring Manager</Label>
              <Select value={hiringManagerId} onValueChange={setHiringManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose hiring lead..." />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Publication Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published & Active</SelectItem>
                  <SelectItem value="draft">Internal Draft</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed / Filled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <Label htmlFor="job-desc">Job Description & Qualifications</Label>
            <Textarea
              id="job-desc"
              rows={4}
              placeholder="Outline responsibilities, key skills required, and team impact..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : jobToEdit
                ? "Update Opening"
                : "Publish Opening"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
