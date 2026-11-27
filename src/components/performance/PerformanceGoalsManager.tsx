import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  PerformanceGoal,
  PerformanceCycle,
  GoalType,
  GoalStatus,
  getGoalStatusBadge,
  calculateGoalCompletionStats,
} from "@/lib/performance-lms";
import {
  Target,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  User,
  Building,
  Edit2,
  Trash2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";

interface PerformanceGoalsManagerProps {
  filterEmployeeId?: string | undefined;
  readOnly?: boolean | undefined;
}

export function PerformanceGoalsManager({
  filterEmployeeId,
  readOnly = false,
}: PerformanceGoalsManagerProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");

  // Create Goal Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("individual");
  const [metric, setMetric] = useState("");
  const [targetValue, setTargetValue] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [weightage, setWeightage] = useState<string>("20");
  const [dueDate, setDueDate] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(
    filterEmployeeId || session.employeeId || ""
  );
  const [cycleId, setCycleId] = useState<string>("");

  // Progress Update Dialog State
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<PerformanceGoal | null>(null);
  const [newProgress, setNewProgress] = useState(0);
  const [newCurrentValue, setNewCurrentValue] = useState<string>("");

  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  // Fetch Active Cycles
  const { data: cycles = [] } = useQuery({
    queryKey: ["performance-cycles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_cycles" as any)
        .select("*")
        .order("start_date", { ascending: false });
      if (error) return [];
      return (data ?? []) as unknown as PerformanceCycle[];
    },
  });

  // Fetch Employees for assignment (if manager/admin)
  const { data: employees = [] } = useQuery({
    queryKey: ["assignable-employees", session.employeeId],
    enabled: isManager && !filterEmployeeId,
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, department_id, departments(name)")
        .eq("status", "active")
        .neq("is_superadmin", true)
        .order("full_name");

      if (session.isManager && !isHRorAdmin && session.employeeId) {
        query = query.or(`manager_id.eq.${session.employeeId},id.eq.${session.employeeId}`);
      }
      const { data, error } = await query;
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch Goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: [
      "performance-goals",
      filterEmployeeId || "all",
      selectedCycleId,
      session.employeeId,
    ],
    queryFn: async () => {
      let query = supabase
        .from("performance_goals" as any)
        .select(
          `
          *,
          employees:employee_id(id, full_name, employee_code, designation, departments(name)),
          departments:department_id(name),
          performance_cycles:cycle_id(title)
        `
        )
        .order("created_at", { ascending: false });

      if (filterEmployeeId) {
        query = query.eq("employee_id", filterEmployeeId);
      } else if (!isHRorAdmin && session.employeeId) {
        if (session.isManager) {
          // Managers see their team goals
          const teamIds = (employees as any[]).map((e) => e.id);
          if (teamIds.length > 0) {
            query = query.in("employee_id", teamIds);
          } else {
            query = query.eq("employee_id", session.employeeId);
          }
        } else {
          // Regular employee sees their own goals
          query = query.eq("employee_id", session.employeeId);
        }
      }

      if (selectedCycleId && selectedCycleId !== "all") {
        query = query.eq("cycle_id", selectedCycleId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Error fetching goals:", error);
        return [];
      }

      return (data ?? []).map((row: any) => ({
        ...row,
        employee: row.employees,
        department: row.departments,
        cycle: row.performance_cycles,
      })) as PerformanceGoal[];
    },
  });

  // Create Goal Mutation
  const createGoalMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Goal title is required");
      const empId = filterEmployeeId || assignedEmployeeId || session.employeeId;
      if (!empId) throw new Error("Please select an employee for this goal");

      const { data, error } = await supabase
        .from("performance_goals" as any)
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          goal_type: goalType,
          employee_id: empId,
          cycle_id: cycleId || null,
          metric: metric.trim() || null,
          target_value: targetValue ? Number(targetValue) : null,
          current_value: 0,
          unit: unit.trim() || null,
          weightage: weightage ? Number(weightage) : 20,
          progress: 0,
          status: "not_started",
          due_date: dueDate || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Performance goal created successfully");
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create goal");
    },
  });

  // Update Progress Mutation
  const updateProgressMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoal) return;
      const progressNum = Math.min(100, Math.max(0, Number(newProgress)));
      let autoStatus: GoalStatus = "in_progress";
      if (progressNum >= 100) {
        autoStatus = "achieved";
      } else if (progressNum === 0) {
        autoStatus = "not_started";
      }

      const { error } = await supabase.rpc("update_goal_progress", {
        p_goal_id: selectedGoal.id,
        p_progress: progressNum,
        p_current_value: newCurrentValue ? Number(newCurrentValue) : null,
        p_status: autoStatus,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal progress updated");
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      setProgressDialogOpen(false);
      setSelectedGoal(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update goal progress");
    },
  });

  // Delete Goal Mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("performance_goals" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal removed");
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete goal");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setGoalType("individual");
    setMetric("");
    setTargetValue("");
    setUnit("");
    setWeightage("20");
    setDueDate("");
    setAssignedEmployeeId(filterEmployeeId || session.employeeId || "");
    setCycleId("");
  };

  const openProgressModal = (goal: PerformanceGoal) => {
    setSelectedGoal(goal);
    setNewProgress(goal.progress || 0);
    setNewCurrentValue(goal.current_value !== null ? String(goal.current_value) : "");
    setProgressDialogOpen(true);
  };

  // Filtered goals
  const filteredGoals = goals.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.employee?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.employee?.employee_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === "all" || g.goal_type === selectedType;
    const matchesStatus = selectedStatus === "all" || g.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = calculateGoalCompletionStats(goals);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Goals & KPIs</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Achieved / Exceeded</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.completed}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">In Progress</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {stats.inProgress}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Avg. Completion</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {stats.averageProgress}%
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search goals, KPIs, or employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Goal Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="kpi">Key KPI</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="achieved">Achieved</SelectItem>
              <SelectItem value="exceeded">Exceeded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {cycles.length > 0 && (
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[150px] h-9 text-xs hidden md:flex">
                <SelectValue placeholder="Review Cycle" />
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

        {!readOnly && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
            className="h-9 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Set New Goal</span>
          </Button>
        )}
      </div>

      {/* Goals Grid / List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading performance goals & KPIs...</p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg border-border bg-card/50">
          <Target className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Goals Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || selectedType !== "all" || selectedStatus !== "all"
              ? "No goals match your active filters. Try adjusting your search."
              : "No performance goals or KPIs have been assigned yet."}
          </p>
          {!readOnly && (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Goal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const badge = getGoalStatusBadge(goal.status);
            const isIndividual = goal.goal_type === "individual";
            const isKPI = goal.goal_type === "kpi";

            return (
              <Card
                key={goal.id}
                className="border-border hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            isKPI
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[11px]"
                              : isIndividual
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px]"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                          }
                        >
                          {goal.goal_type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={`${badge.colorClass} text-[11px]`}>
                          {badge.label}
                        </Badge>
                        {goal.weightage && (
                          <span className="text-xs text-muted-foreground font-medium">
                            Weight: {goal.weightage}%
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold text-foreground line-clamp-1">
                        {goal.title}
                      </CardTitle>
                    </div>

                    {!readOnly && (isManager || session.employeeId === goal.employee_id) && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openProgressModal(goal)}
                          title="Update Progress"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {isHRorAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:text-rose-700"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this goal?")) {
                                deleteGoalMutation.mutate(goal.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {goal.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {goal.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  {/* Metric target vs current */}
                  {goal.metric && (
                    <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded-lg">
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        {goal.metric}:
                      </span>
                      <span className="font-semibold text-foreground">
                        {goal.current_value ?? 0}{" "}
                        {goal.target_value ? `/ ${goal.target_value}` : ""}{" "}
                        {goal.unit || ""}
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completion Progress</span>
                      <span className="font-bold text-foreground">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2 rounded-full" />
                  </div>

                  {/* Meta: Employee, Due date, Cycle */}
                  <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">
                        {goal.employee?.full_name || "Unassigned"}
                      </span>
                      {goal.employee?.designation && (
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          ({goal.employee.designation})
                        </span>
                      )}
                    </div>

                    {goal.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Due {new Date(goal.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE GOAL DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              <span>Define Performance Goal & KPI</span>
            </DialogTitle>
            <DialogDescription>
              Set clear measurable targets, weightage, and timeline for performance tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">
                Goal Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="goal-title"
                placeholder="Enter goal title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="goal-desc">Description & Success Criteria</Label>
              <Textarea
                id="goal-desc"
                placeholder="Explain the objectives, milestones, and how success is evaluated..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Goal Type & Assignee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Goal Type</Label>
                <Select
                  value={goalType}
                  onValueChange={(v: GoalType) => setGoalType(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual Goal</SelectItem>
                    <SelectItem value="department">Department Goal</SelectItem>
                    <SelectItem value="kpi">Key KPI Metric</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee Selection (if manager/admin) */}
              {!filterEmployeeId && isManager ? (
                <div className="space-y-1.5">
                  <Label>Assignee Employee</Label>
                  <Select
                    value={assignedEmployeeId}
                    onValueChange={setAssignedEmployeeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Employee" />
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
              ) : null}
            </div>

            {/* Metric & Target Value */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="goal-metric">Metric Name</Label>
                <Input
                  id="goal-metric"
                  placeholder="Enter metric name"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target Value</Label>
                <Input
                  id="goal-target"
                  type="number"
                  placeholder="100"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal-unit">Unit</Label>
                <Input
                  id="goal-unit"
                  placeholder="Enter unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            {/* Weightage & Cycle & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-weightage">Weightage (%)</Label>
                <Input
                  id="goal-weightage"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="20"
                  value={weightage}
                  onChange={(e) => setWeightage(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Appraisal Cycle</Label>
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Cycle</SelectItem>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal-due">Target Due Date</Label>
                <Input
                  id="goal-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createGoalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createGoalMutation.mutate()}
              disabled={createGoalMutation.isPending}
            >
              {createGoalMutation.isPending ? "Creating..." : "Save Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPDATE PROGRESS DIALOG */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Update Goal Progress</span>
            </DialogTitle>
            <DialogDescription className="line-clamp-1">
              {selectedGoal?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label>Completion Percentage</Label>
                <span className="font-bold text-primary text-base">{newProgress}%</span>
              </div>
              <Slider
                value={[newProgress]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) => setNewProgress(val[0] ?? 0)}
              />
            </div>

            {selectedGoal?.metric && (
              <div className="space-y-1.5">
                <Label htmlFor="curr-val">
                  Current {selectedGoal.metric} {selectedGoal.unit ? `(${selectedGoal.unit})` : ""}
                </Label>
                <Input
                  id="curr-val"
                  type="number"
                  placeholder={String(selectedGoal.target_value ?? 0)}
                  value={newCurrentValue}
                  onChange={(e) => setNewCurrentValue(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProgressDialogOpen(false)}
              disabled={updateProgressMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateProgressMutation.mutate()}
              disabled={updateProgressMutation.isPending}
            >
              {updateProgressMutation.isPending ? "Updating..." : "Save Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
