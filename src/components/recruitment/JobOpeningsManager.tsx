import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Building2,
  MapPin,
  Users,
  Search,
  Plus,
  Edit2,
  Clock,
  Sparkles,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JobOpening, formatSalary } from "@/lib/recruitment";
import { JobOpeningModal } from "./JobOpeningModal";

interface JobOpeningsManagerProps {
  onSelectJobForCandidates?: (jobId: string) => void;
}

export function JobOpeningsManager({
  onSelectJobForCandidates,
}: JobOpeningsManagerProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);

  // Fetch job openings with applicant counts
  const { data: jobOpenings = [], isLoading } = useQuery({
    queryKey: ["job-openings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_openings")
        .select(`
          *,
          departments:department_id ( name ),
          hiring_manager:hiring_manager_id ( full_name, employee_code )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load job openings:", error.message);
        return [];
      }

      // Also get candidate counts per job
      const { data: candidates } = await supabase
        .from("candidates")
        .select("job_opening_id");

      const counts: Record<string, number> = {};
      (candidates ?? []).forEach((c) => {
        if (c.job_opening_id) {
          counts[c.job_opening_id] = (counts[c.job_opening_id] || 0) + 1;
        }
      });

      return (data ?? []).map((job) => ({
        ...job,
        candidates_count: counts[job.id] || 0,
      })) as JobOpening[];
    },
  });

  // Filter openings
  const filteredJobs = jobOpenings.filter((job) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchDept = job.departments?.name?.toLowerCase().includes(q);
      const matchLoc = job.location?.toLowerCase().includes(q);
      if (!matchTitle && !matchDept && !matchLoc) return false;
    }
    if (deptFilter !== "all" && job.departments?.name !== deptFilter) return false;
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    return true;
  });

  const uniqueDepartments = Array.from(
    new Set(
      jobOpenings
        .map((j) => j.departments?.name)
        .filter((d): d is string => Boolean(d))
    )
  );

  const activeCount = jobOpenings.filter((j) => j.status === "published").length;
  const totalPositions = jobOpenings
    .filter((j) => j.status === "published")
    .reduce((acc, curr) => acc + (curr.openings_count || 1), 0);
  const totalCandidates = jobOpenings.reduce(
    (acc, curr) => acc + (curr.candidates_count || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>ACTIVE JOB OPENINGS</span>
              <Briefcase className="w-4 h-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {activeCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Published roles open for candidate applications
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>TOTAL TARGET POSITIONS</span>
              <Users className="w-4 h-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {totalPositions}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Total approved hiring headcount quota
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>TOTAL CANDIDATES POOL</span>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {totalCandidates}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Applicants received across all vacancies
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search job title, department, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {uniqueDepartments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {uniqueDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => {
              setEditingJob(null);
              setModalOpen(true);
            }}
            className="h-9 gap-1.5 text-xs ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Job Opening</span>
          </Button>
        </div>
      </div>

      {/* Job Openings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="font-semibold text-foreground text-base">
            No job openings match your filter
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create new job requisitions to start receiving candidate applications and scheduling interviews.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setEditingJob(null);
              setModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Publish First Opening
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const isPublished = job.status === "published";

            return (
              <Card
                key={job.id}
                className="hover:border-primary/50 transition flex flex-col justify-between p-5 space-y-4 bg-card group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                        {job.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {job.departments?.name && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {job.departments.name}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        isPublished
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                          : "text-muted-foreground bg-muted/40 text-[10px]"
                      }
                    >
                      {job.status.toUpperCase()}
                    </Badge>
                  </div>

                  {job.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>
                  )}

                  {/* Attributes Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {job.workplace_type || "Hybrid"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {job.experience_level || "Mid"} Level
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {job.employment_type?.replace("_", " ") || "Full Time"}
                    </Badge>
                  </div>

                  {/* Salary & Headcount */}
                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {job.min_salary || job.max_salary
                        ? `${formatSalary(job.min_salary)} - ${formatSalary(job.max_salary)}`
                        : "Competitive CTC"}
                    </span>
                    <span className="font-mono text-[11px]">
                      {job.openings_count} {job.openings_count === 1 ? "Opening" : "Openings"}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-foreground">
                      {job.candidates_count}
                    </span>
                    <span className="text-muted-foreground">Applicants</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingJob(job);
                        setModalOpen(true);
                      }}
                      title="Edit Job Opening"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>

                    {onSelectJobForCandidates && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        onClick={() => onSelectJobForCandidates(job.id)}
                      >
                        <span>View Pipeline</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Job Opening Edit / Create Modal */}
      <JobOpeningModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobToEdit={editingJob}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["job-openings-list"] });
        }}
      />
    </div>
  );
}
