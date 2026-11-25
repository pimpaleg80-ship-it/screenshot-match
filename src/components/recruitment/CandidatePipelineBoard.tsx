import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Users,
  Briefcase,
  Star,
  Plus,
  ArrowRight,
  UserCheck,
  Calendar,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  Candidate,
  CandidateStage,
  RECRUITMENT_STAGES,
  getCandidateStageBadge,
  formatSalary,
} from "@/lib/recruitment";
import { formatDate } from "@/lib/attendance";

interface CandidatePipelineBoardProps {
  candidates: Candidate[];
  onSelectCandidate: (candidateId: string) => void;
  onAddCandidateClick: () => void;
  selectedJobId?: string | null;
  onJobFilterChange?: (jobId: string) => void;
  jobOpenings?: { id: string; title: string }[];
}

export function CandidatePipelineBoard({
  candidates,
  onSelectCandidate,
  onAddCandidateClick,
  selectedJobId,
  onJobFilterChange,
  jobOpenings = [],
}: CandidatePipelineBoardProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId || "all");

  const filteredCandidates = candidates.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.full_name.toLowerCase().includes(q);
      const matchEmail = c.email.toLowerCase().includes(q);
      const matchCompany = c.current_company?.toLowerCase().includes(q);
      const matchDesig = c.current_designation?.toLowerCase().includes(q);
      const matchJob = c.job_openings?.title?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchCompany && !matchDesig && !matchJob)
        return false;
    }
    if (jobFilter !== "all" && c.job_opening_id !== jobFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Control & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate name, email, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {jobOpenings.length > 0 && (
            <Select
              value={jobFilter}
              onValueChange={(val) => {
                setJobFilter(val);
                if (onJobFilterChange) onJobFilterChange(val);
              }}
            >
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                <SelectValue placeholder="All Job Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Openings</SelectItem>
                {jobOpenings.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />
              Pipeline
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setViewMode("table")}
            >
              <List className="w-3.5 h-3.5 mr-1" />
              Table
            </Button>
          </div>

          <Button
            size="sm"
            onClick={onAddCandidateClick}
            className="h-9 gap-1.5 text-xs ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Candidate</span>
          </Button>
        </div>
      </div>

      {/* KANBAN PIPELINE VIEW */}
      {viewMode === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1400px] items-start">
            {RECRUITMENT_STAGES.map((stage) => {
              const stageCandidates = filteredCandidates.filter(
                (c) => c.stage === stage.key
              );

              return (
                <div
                  key={stage.key}
                  className="w-72 shrink-0 bg-muted/20 border rounded-lg p-3 flex flex-col min-h-[520px] space-y-3"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {stage.label}
                      </span>
                      <Badge variant="outline" className="text-[11px] font-mono px-2">
                        {stageCandidates.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Candidate Cards Column */}
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                    {stageCandidates.length === 0 ? (
                      <div className="h-28 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground text-center p-3">
                        No applicants in {stage.label}
                      </div>
                    ) : (
                      stageCandidates.map((cand) => (
                        <Card
                          key={cand.id}
                          className="p-3.5 hover:border-primary/50 hover:shadow-md transition cursor-pointer bg-card group space-y-2.5"
                          onClick={() => onSelectCandidate(cand.id)}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                {cand.full_name}
                              </h4>
                              {cand.current_designation && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {cand.current_designation}
                                  {cand.current_company && ` • ${cand.current_company}`}
                                </p>
                              )}
                            </div>

                            {cand.rating ? (
                              <div className="flex items-center gap-0.5 text-amber-500 text-[11px] font-bold shrink-0">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span>{cand.rating}</span>
                              </div>
                            ) : null}
                          </div>

                          {cand.job_openings?.title && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal truncate max-w-full block"
                            >
                              {cand.job_openings.title}
                            </Badge>
                          )}

                          <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{cand.years_of_experience || 0} yrs exp</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {cand.expected_salary
                                ? formatSalary(cand.expected_salary)
                                : "—"}
                            </span>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <Card>
          <CardContent className="p-0">
            {filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                <Users className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="font-semibold text-foreground text-sm">
                  No candidates found
                </p>
                <p>Register new applicants to populate the recruitment pipeline.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Candidate</TableHead>
                      <TableHead>Job Opening</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Current / Expected CTC</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidates.map((cand) => {
                      const stageB = getCandidateStageBadge(cand.stage);

                      return (
                        <TableRow
                          key={cand.id}
                          className="hover:bg-muted/40 cursor-pointer"
                          onClick={() => onSelectCandidate(cand.id)}
                        >
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-sm text-foreground">
                                {cand.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {cand.email}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-medium">
                              {cand.job_openings?.title || "General Pool"}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className={stageB.colorClass}>
                              {stageB.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs">
                            {cand.years_of_experience || 0} Years
                          </TableCell>

                          <TableCell className="text-xs font-mono">
                            {cand.current_salary ? formatSalary(cand.current_salary) : "—"} /{" "}
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {cand.expected_salary ? formatSalary(cand.expected_salary) : "—"}
                            </span>
                          </TableCell>

                          <TableCell>
                            {cand.rating ? (
                              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span>{cand.rating}/5</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-primary gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCandidate(cand.id);
                              }}
                            >
                              <span>View Profile</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
