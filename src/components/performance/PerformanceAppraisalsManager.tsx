import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  PerformanceReview,
  PerformanceCycle,
  getReviewStageBadge,
  getGradeBadge,
} from "@/lib/performance-lms";
import { SelfAssessmentModal } from "./SelfAssessmentModal";
import { ManagerEvaluationModal } from "./ManagerEvaluationModal";
import {
  Award,
  Search,
  Filter,
  User,
  Star,
  CheckCircle2,
  Clock,
  Plus,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PerformanceAppraisalsManagerProps {
  filterEmployeeId?: string | undefined;
  readOnly?: boolean | undefined;
}

export function PerformanceAppraisalsManager({
  filterEmployeeId,
  readOnly = false,
}: PerformanceAppraisalsManagerProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");

  // Modals state
  const [selfModalOpen, setSelfModalOpen] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [activeReview, setActiveReview] = useState<PerformanceReview | null>(null);

  // New Appraisal Dialog State
  const [newReviewOpen, setNewReviewOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedCycleForNew, setSelectedCycleForNew] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("FY 2026-27");

  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  // Fetch Review Cycles
  const { data: cycles = [] } = useQuery({
    queryKey: ["appraisal-cycles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_cycles" as any)
        .select("*")
        .order("start_date", { ascending: false });
      if (error) return [];
      return (data ?? []) as unknown as PerformanceCycle[];
    },
  });

  // Fetch Employees for HR to create new review
  const { data: employees = [] } = useQuery({
    queryKey: ["appraisal-eligible-employees"],
    enabled: isManager && !filterEmployeeId,
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, manager_id, department_id, departments(name)")
        .eq("status", "active")
        .neq("is_superadmin", true)
        .order("full_name");

      if (session.isManager && !isHRorAdmin && session.employeeId) {
        query = query.or(`manager_id.eq.${session.employeeId},id.eq.${session.employeeId}`);
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  // Fetch Performance Reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: [
      "performance-reviews",
      filterEmployeeId || "all",
      selectedCycleId,
      session.employeeId,
    ],
    queryFn: async () => {
      let query = supabase
        .from("performance_reviews" as any)
        .select(
          `
          *,
          employee:employees!performance_reviews_employee_id_fkey(id, full_name, employee_code, designation, photo_url, department_id, departments(name), manager_id),
          reviewer:employees!performance_reviews_reviewer_id_fkey(id, full_name, employee_code, designation),
          cycle:performance_cycles!performance_reviews_cycle_id_fkey(id, title, cycle_type, due_date)
        `
        )
        .order("created_at", { ascending: false });

      if (filterEmployeeId) {
        query = query.eq("employee_id", filterEmployeeId);
      } else if (!isHRorAdmin && session.employeeId) {
        if (session.isManager) {
          const teamIds = (employees as any[]).map((e) => e.id);
          if (teamIds.length > 0) {
            query = query.in("employee_id", teamIds);
          } else {
            query = query.eq("employee_id", session.employeeId);
          }
        } else {
          query = query.eq("employee_id", session.employeeId);
        }
      }

      if (selectedCycleId && selectedCycleId !== "all") {
        query = query.eq("cycle_id", selectedCycleId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Could not load reviews:", error);
        return [];
      }
      return (data ?? []) as unknown as PerformanceReview[];
    },
  });

  // Create Review Mutation (HR)
  const createReviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId) throw new Error("Please select an employee");
      const emp = (employees as any[]).find((e) => e.id === selectedEmployeeId);

      const { error } = await supabase.from("performance_reviews" as any).insert({
        employee_id: selectedEmployeeId,
        reviewer_id: emp?.manager_id || session.employeeId || null,
        cycle_id: selectedCycleForNew || null,
        review_period: reviewPeriod.trim() || "Annual Review",
        stage: "self_review",
        status: "pending",
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appraisal record initialized for employee");
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      setNewReviewOpen(false);
      setSelectedEmployeeId("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to initialize appraisal");
    },
  });

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employee?.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.review_period?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = selectedStage === "all" || r.stage === selectedStage;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search appraisals, employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="self_review">Self Review</SelectItem>
              <SelectItem value="manager_review">Manager Review</SelectItem>
              <SelectItem value="hr_calibration">Calibration</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {cycles.length > 0 && (
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[150px] h-9 text-xs hidden md:flex">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isManager && !readOnly && !filterEmployeeId && (
          <Button
            size="sm"
            onClick={() => setNewReviewOpen(true)}
            className="h-9 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Initiate Appraisal</span>
          </Button>
        )}
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading performance appraisals...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg border-border bg-card/50">
          <Award className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Appraisal Records</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || selectedStage !== "all"
              ? "No appraisal records match your filters."
              : "No performance reviews have been created for this evaluation period."}
          </p>
          {isManager && !readOnly && (
            <Button size="sm" onClick={() => setNewReviewOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Initiate Appraisal
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => {
            const stageBadge = getReviewStageBadge(review.stage);
            const gradeBadge = getGradeBadge(review.final_grade);
            const isEmployeeSelf = session.employeeId === review.employee_id;
            const isAssignedManager =
              session.employeeId === review.reviewer_id ||
              session.employeeId === review.employee?.manager_id ||
              isHRorAdmin;

            return (
              <Card
                key={review.id}
                className="border-border hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left: Employee Info & Stage */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`${stageBadge.colorClass} text-xs font-semibold`}>
                        {stageBadge.label}
                      </Badge>
                      {review.final_grade && (
                        <Badge variant="outline" className={`${gradeBadge.colorClass} text-xs`}>
                          {gradeBadge.label}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-medium">
                        {review.cycle?.title || review.review_period}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {review.employee?.full_name?.charAt(0) || "E"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">
                          {review.employee?.full_name} ({review.employee?.employee_code})
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {review.employee?.designation || "Employee"} •{" "}
                          {review.employee?.departments?.name || "General"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Ratings Scorecard */}
                  <div className="flex items-center gap-6 text-xs text-muted-foreground border-y sm:border-y-0 sm:border-x border-border py-2 sm:py-0 sm:px-6 w-full sm:w-auto justify-around sm:justify-start">
                    <div className="text-center">
                      <p className="text-[11px] font-medium">Self Rating</p>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {review.self_rating ? `${review.self_rating} / 5` : "Pending"}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-[11px] font-medium">Manager Rating</p>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {review.manager_rating ? `${review.manager_rating} / 5` : "Pending"}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-[11px] font-medium">Final Score</p>
                      <p className="text-base font-bold text-primary mt-0.5">
                        {review.final_score ? `${review.final_score} / 5` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Self-Assessment Action for employee */}
                    {isEmployeeSelf && review.stage === "self_review" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveReview(review);
                          setSelfModalOpen(true);
                        }}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Submit Self-Assessment</span>
                      </Button>
                    )}

                    {/* Manager Evaluation Action */}
                    {isAssignedManager && (
                      <Button
                        size="sm"
                        variant={review.stage === "manager_review" ? "default" : "outline"}
                        onClick={() => {
                          setActiveReview(review);
                          setManagerModalOpen(true);
                        }}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>
                          {review.manager_rating ? "Update Evaluation" : "Evaluate Employee"}
                        </span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* NEW APPRAISAL DIALOG */}
      <Dialog open={newReviewOpen} onOpenChange={setNewReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span>Initiate Appraisal Record</span>
            </DialogTitle>
            <DialogDescription>
              Assign a performance review record to an employee under an active review cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Employee" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Review Cycle</Label>
              <Select
                value={selectedCycleForNew}
                onValueChange={setSelectedCycleForNew}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rev-period">Review Period Label</Label>
              <Input
                id="rev-period"
                placeholder="Enter review period"
                value={reviewPeriod}
                onChange={(e) => setReviewPeriod(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewReviewOpen(false)}
              disabled={createReviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createReviewMutation.mutate()}
              disabled={createReviewMutation.isPending}
            >
              {createReviewMutation.isPending ? "Creating..." : "Initialize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALS */}
      <SelfAssessmentModal
        open={selfModalOpen}
        onOpenChange={setSelfModalOpen}
        review={activeReview}
      />
      <ManagerEvaluationModal
        open={managerModalOpen}
        onOpenChange={setManagerModalOpen}
        review={activeReview}
      />
    </div>
  );
}
