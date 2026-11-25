import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  ThumbsUp,
  Lock,
  User,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmployeeSuggestion,
  SuggestionStatus,
  SUGGESTION_STATUS_CONFIG,
} from "@/lib/engagement";

interface SuggestionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: EmployeeSuggestion | null;
  employeeId: string;
  isAdmin: boolean;
  userId: string;
}

export function SuggestionDetailModal({
  open,
  onOpenChange,
  suggestion,
  employeeId,
  isAdmin,
  userId,
}: SuggestionDetailModalProps) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<SuggestionStatus>(
    suggestion?.status || "submitted"
  );
  const [adminNotes, setAdminNotes] = useState(suggestion?.admin_notes || "");

  // Update Status mutation (Admin only)
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!suggestion?.id) return;
      const { error } = await supabase
        .from("employee_suggestions")
        .update({
          status,
          admin_notes: adminNotes.trim() || null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", suggestion.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-suggestions"] });
      toast.success("Suggestion status updated.");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update suggestion.");
    },
  });

  // Upvote toggle mutation
  const upvoteMutation = useMutation({
    mutationFn: async () => {
      if (!suggestion?.id) return;
      const { data, error } = await supabase.rpc(
        "toggle_suggestion_upvote" as any,
        {
          _suggestion_id: suggestion.id,
          _employee_id: employeeId,
        }
      );
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-suggestions"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upvote.");
    },
  });

  if (!suggestion) return null;

  const statusConfig = SUGGESTION_STATUS_CONFIG[suggestion.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {suggestion.category}
            </Badge>
            <Badge variant="outline" className={statusConfig?.badgeClass}>
              {statusConfig?.label || suggestion.status}
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground mt-2">
            {suggestion.title}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            {suggestion.is_anonymous ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Lock className="h-3.5 w-3.5" /> Anonymous Idea
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {suggestion.employee?.full_name || "Employee"} (
                {suggestion.employee?.department?.name || "General"})
              </span>
            )}
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(suggestion.created_at).toLocaleDateString()}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Proposal body */}
          <div className="p-4 rounded-lg border bg-card text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {suggestion.description}
          </div>

          {/* Upvotes bar */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{suggestion.upvotes_count}</strong> colleagues support this idea
            </div>
            <Button
              size="sm"
              variant={suggestion.upvoted_by_me ? "default" : "outline"}
              className="gap-1.5 text-xs h-8"
              onClick={() => upvoteMutation.mutate()}
              disabled={upvoteMutation.isPending}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {suggestion.upvoted_by_me ? "Upvoted" : "Upvote"}
            </Button>
          </div>

          {/* Admin response notes if existing */}
          {suggestion.admin_notes && !isAdmin && (
            <div className="p-3.5 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 space-y-1">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Management Review Response
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                {suggestion.admin_notes}
              </p>
            </div>
          )}

          {/* Admin Status Review Controls */}
          {isAdmin && (
            <div className="p-4 rounded-lg border bg-muted/40 space-y-3">
              <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Management Triage
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Update Status</Label>
                  <Select
                    value={status}
                    onValueChange={(val) => setStatus(val as SuggestionStatus)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUGGESTION_STATUS_CONFIG).map(([k, cfg]) => (
                        <SelectItem key={k} value={k}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Leadership Response / Notes</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  placeholder="Share feedback, updates on feasibility, or action plans with the team..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate()}
                disabled={updateStatusMutation.isPending}
                className="w-full text-xs h-8"
              >
                {updateStatusMutation.isPending ? "Updating..." : "Save Management Triage"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
