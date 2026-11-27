import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PerformanceCycle,
  PerformanceCycleType,
  PerformanceCycleStatus,
} from "@/lib/performance-lms";
import { Calendar, Plus, Edit2, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export function ReviewCyclesModal() {
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<PerformanceCycle | null>(null);

  const [title, setTitle] = useState("");
  const [cycleType, setCycleType] = useState<PerformanceCycleType>("annual");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PerformanceCycleStatus>("active");

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["performance-cycles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_cycles" as any)
        .select("*")
        .order("start_date", { ascending: false });
      if (error) return [];
      return (data ?? []) as unknown as PerformanceCycle[];
    },
  });

  const saveCycleMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Cycle title is required");
      if (!startDate || !dueDate) throw new Error("Start and due dates are required");

      if (editingCycle) {
        const { error } = await supabase
          .from("performance_cycles" as any)
          .update({
            title: title.trim(),
            cycle_type: cycleType,
            start_date: startDate,
            due_date: dueDate,
            description: description.trim() || null,
            status,
          } as any)
          .eq("id", editingCycle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("performance_cycles" as any).insert({
          title: title.trim(),
          cycle_type: cycleType,
          start_date: startDate,
          due_date: dueDate,
          description: description.trim() || null,
          status,
        } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCycle ? "Review cycle updated" : "Review cycle initiated");
      queryClient.invalidateQueries({ queryKey: ["performance-cycles-admin"] });
      queryClient.invalidateQueries({ queryKey: ["performance-cycles"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save review cycle");
    },
  });

  const resetForm = () => {
    setEditingCycle(null);
    setTitle("");
    setCycleType("annual");
    setStartDate("");
    setDueDate("");
    setDescription("");
    setStatus("active");
  };

  const openEditModal = (c: PerformanceCycle) => {
    setEditingCycle(c);
    setTitle(c.title);
    setCycleType((c.cycle_type as PerformanceCycleType) || "annual");
    setStartDate(c.start_date);
    setDueDate(c.due_date);
    setDescription(c.description || "");
    setStatus((c.status as PerformanceCycleStatus) || "active");
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-lg border border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>Appraisal & Review Cycles</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure monthly performance checks, quarterly goals, and annual compensation review cycles.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
          className="gap-1.5 h-9"
        >
          <Plus className="w-4 h-4" />
          <span>New Review Cycle</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading review cycles...</p>
        </div>
      ) : cycles.length === 0 ? (
        <div className="py-12 text-center border border-dashed rounded-lg border-border bg-card/40">
          <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No Cycles Defined</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
            Initialize an annual or quarterly performance cycle to trigger self-reviews and manager evaluations.
          </p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Cycle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cycles.map((c) => {
            const isActive = c.status === "active";
            const isClosed = c.status === "closed";

            return (
              <Card key={c.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                              : isClosed
                              ? "bg-muted text-muted-foreground text-[11px]"
                              : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px]"
                          }
                        >
                          {c.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium capitalize">
                          {c.cycle_type} Review
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-foreground mt-1.5">{c.title}</h4>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditModal(c)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Start: <strong>{new Date(c.start_date).toLocaleDateString()}</strong>
                    </span>
                    <span>
                      Due: <strong>{new Date(c.due_date).toLocaleDateString()}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>{editingCycle ? "Edit Review Cycle" : "Initiate Review Cycle"}</span>
            </DialogTitle>
            <DialogDescription>
              Set cycle parameters, timeline, and appraisal evaluation window.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-title">
                Cycle Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="cycle-title"
                placeholder="Enter cycle title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cadence</Label>
                <Select
                  value={cycleType}
                  onValueChange={(v: PerformanceCycleType) => setCycleType(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual Appraisal</SelectItem>
                    <SelectItem value="quarterly">Quarterly Review</SelectItem>
                    <SelectItem value="monthly">Monthly Check-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cycle Status</Label>
                <Select
                  value={status}
                  onValueChange={(v: PerformanceCycleStatus) => setStatus(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active (Open)</SelectItem>
                    <SelectItem value="evaluation">Evaluation Window</SelectItem>
                    <SelectItem value="closed">Closed / Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-start">Start Date</Label>
                <Input
                  id="c-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-due">Due Date</Label>
                <Input
                  id="c-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-desc">Description / Instructions</Label>
              <Textarea
                id="c-desc"
                placeholder="Guidelines for employees and managers during this review..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={saveCycleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveCycleMutation.mutate()}
              disabled={saveCycleMutation.isPending}
            >
              {saveCycleMutation.isPending ? "Saving..." : "Save Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
