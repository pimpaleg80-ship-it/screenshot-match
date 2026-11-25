import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  User,
  Calendar,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import {
  EmployeeOnboardingRecord,
  getOnboardingStatusBadge,
} from "@/lib/onboarding";
import { formatDate } from "@/lib/attendance";

interface OnboardingPipelineBoardProps {
  onboardings: EmployeeOnboardingRecord[];
  onSelectOnboarding: (record: EmployeeOnboardingRecord) => void;
  onInitiateClick: () => void;
}

const STAGES = [
  {
    key: "in_progress",
    title: "In Progress",
    description: "Candidates actively completing checklist",
    color: "border-amber-500/30 text-amber-600 bg-amber-500/10",
  },
  {
    key: "pending_hr_review",
    title: "Pending HR Review",
    description: "Checklist submitted, waiting for verification",
    color: "border-indigo-500/30 text-indigo-600 bg-indigo-500/10",
  },
  {
    key: "completed",
    title: "Completed & Active",
    description: "Fully verified and onboarded into FlowPeople",
    color: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
  },
  {
    key: "draft",
    title: "Pre-Onboarding Draft",
    description: "Offer created or pending start date",
    color: "border-muted text-muted-foreground bg-muted/20",
  },
];

export function OnboardingPipelineBoard({
  onboardings,
  onSelectOnboarding,
  onInitiateClick,
}: OnboardingPipelineBoardProps) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const filteredOnboardings = onboardings.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.employees?.full_name?.toLowerCase().includes(q);
      const matchCode = item.employees?.employee_code?.toLowerCase().includes(q);
      const matchDesig = item.employees?.designation?.toLowerCase().includes(q);
      const matchDept = item.employees?.departments?.name?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDesig && !matchDept) return false;
    }
    if (departmentFilter !== "all") {
      if (item.employees?.departments?.name !== departmentFilter) return false;
    }
    return true;
  });

  // Extract unique departments for filter dropdown
  const departments = Array.from(
    new Set(
      onboardings
        .map((o) => o.employees?.departments?.name)
        .filter((d): d is string => Boolean(d))
    )
  );

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate name, ID, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {departments.length > 0 && (
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={onInitiateClick}
            className="h-9 gap-1.5 text-xs ml-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Onboarding</span>
          </Button>
        </div>
      </div>

      {/* Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {STAGES.map((stage) => {
          const stageItems = filteredOnboardings.filter(
            (item) => item.status === stage.key
          );

          return (
            <div
              key={stage.key}
              className="bg-muted/20 border rounded-lg p-3 space-y-3 flex flex-col min-h-[480px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {stage.title}
                    </span>
                    <Badge variant="outline" className={stage.color + " text-[11px]"}>
                      {stageItems.length}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {stage.description}
                  </p>
                </div>
              </div>

              {/* Cards inside column */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                {stageItems.length === 0 ? (
                  <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                    No candidates in this stage
                  </div>
                ) : (
                  stageItems.map((record) => {
                    const emp = record.employees;
                    const isOverdue =
                      record.target_completion_date &&
                      record.status !== "completed" &&
                      new Date(record.target_completion_date).getTime() <
                        Date.now();

                    return (
                      <Card
                        key={record.id}
                        className="p-4 hover:border-primary/50 hover:shadow-md transition cursor-pointer bg-card group relative"
                        onClick={() => onSelectOnboarding(record)}
                      >
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                {emp?.full_name || "New Hire"}
                              </h4>
                              <p className="text-xs text-muted-foreground font-mono">
                                {emp?.employee_code || "EMP-TBD"}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Designation & Department */}
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {emp?.designation && (
                              <p className="font-medium text-foreground truncate">
                                {emp.designation}
                              </p>
                            )}
                            {emp?.departments?.name && (
                              <p className="truncate">{emp.departments.name}</p>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-semibold text-foreground">
                                {record.progress_percentage}%
                              </span>
                            </div>
                            <Progress
                              value={record.progress_percentage}
                              className="h-1.5"
                            />
                          </div>

                          {/* Footer / Target Date */}
                          <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                            {record.target_completion_date ? (
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue
                                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                                    : ""
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {isOverdue
                                  ? "Overdue"
                                  : `Target: ${formatDate(record.target_completion_date)}`}
                              </span>
                            ) : (
                              <span>No deadline</span>
                            )}

                            {record.onboarding_templates?.name && (
                              <span className="truncate max-w-[100px] text-muted-foreground font-mono text-[10px]">
                                {record.onboarding_templates.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
