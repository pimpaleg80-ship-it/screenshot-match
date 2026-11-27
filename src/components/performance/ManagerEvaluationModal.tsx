import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PerformanceReview,
  ManagerRecommendation,
  calculateWeightedScore,
  getGradeBadge,
} from "@/lib/performance-lms";
import { Star, Award, CheckCircle2, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

interface ManagerEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: PerformanceReview | null;
}

export function ManagerEvaluationModal({
  open,
  onOpenChange,
  review,
}: ManagerEvaluationModalProps) {
  const queryClient = useQueryClient();

  const [managerRating, setManagerRating] = useState<number>(review?.manager_rating || 4);
  const [feedback, setFeedback] = useState<string>("");
  const [strengths, setStrengths] = useState<string>("");
  const [developmentPlan, setDevelopmentPlan] = useState<string>("");
  const [recommendation, setRecommendation] = useState<ManagerRecommendation>("meets_expectations");

  useEffect(() => {
    if (review) {
      setManagerRating(review.manager_rating || 4);
      setFeedback(review.manager_feedback || "");
      setStrengths(review.manager_strengths || "");
      setDevelopmentPlan(review.manager_development_plan || "");
      setRecommendation(
        (review.manager_recommendation as ManagerRecommendation) || "meets_expectations"
      );
    }
  }, [review]);

  const compositeScore = calculateWeightedScore(
    review?.self_rating,
    managerRating,
    0.4,
    0.6
  );

  let calculatedGrade = "Meets Expectations";
  if (compositeScore >= 4.5) calculatedGrade = "Outstanding";
  else if (compositeScore >= 3.8) calculatedGrade = "Exceeds Expectations";
  else if (compositeScore >= 2.8) calculatedGrade = "Meets Expectations";
  else calculatedGrade = "Needs Improvement";

  const gradeBadge = getGradeBadge(calculatedGrade);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!review) return;
      if (!managerRating || managerRating < 1 || managerRating > 5) {
        throw new Error("Please select a manager rating between 1 and 5");
      }
      if (!feedback.trim()) {
        throw new Error("Please provide comprehensive performance feedback");
      }

      const { error } = await supabase.rpc("submit_manager_assessment", {
        p_review_id: review.id,
        p_manager_rating: managerRating,
        p_manager_feedback: feedback.trim(),
        p_manager_strengths: strengths.trim() || null,
        p_manager_development_plan: developmentPlan.trim() || null,
        p_manager_recommendation: recommendation,
        p_final_score: compositeScore,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manager evaluation submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit manager evaluation");
    },
  });

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Award className="w-5 h-5 text-primary" />
            <span>Manager Performance Evaluation</span>
          </DialogTitle>
          <DialogDescription>
            Appraise {review.employee?.full_name} ({review.employee?.employee_code}) for cycle{" "}
            {review.cycle?.title || review.review_period}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee Self Assessment Summary Banner */}
          {review.self_rating ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Employee Self-Assessment Summary
                </span>
                <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">
                  Self Rating: {review.self_rating} / 5.0
                </span>
              </div>
              {review.self_achievements && (
                <div className="text-xs text-foreground/80">
                  <strong className="text-foreground">Achievements:</strong> {review.self_achievements}
                </div>
              )}
              {review.self_growth_areas && (
                <div className="text-xs text-foreground/80">
                  <strong className="text-foreground">Growth Areas:</strong> {review.self_growth_areas}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-xs">
              Employee has not submitted self-assessment yet. You can still submit manager evaluation.
            </div>
          )}

          {/* Rating & Composite Score Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 bg-muted/40 p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Manager Rating (1 - 5)</Label>
                <span className="text-base font-bold text-primary">
                  {managerRating.toFixed(1)} / 5.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setManagerRating(star)}
                    className={`p-1 rounded transition-transform hover:scale-110 ${
                      managerRating >= star
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30 hover:text-amber-400"
                    }`}
                  >
                    <Star className="w-6 h-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-border flex flex-col justify-between">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Composite Final Score & Grade
                </Label>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">
                    {compositeScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 5.0 (40% Self, 60% Mgr)</span>
                </div>
              </div>
              <Badge variant="outline" className={`${gradeBadge.colorClass} w-fit mt-2`}>
                {gradeBadge.label}
              </Badge>
            </div>
          </div>

          {/* Manager Recommendation */}
          <div className="space-y-1.5">
            <Label>Manager Recommendation</Label>
            <Select
              value={recommendation}
              onValueChange={(v: ManagerRecommendation) => setRecommendation(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exceeds_expectations">
                  Exceeds Expectations — Fast Track / Promotion / Merit Increment
                </SelectItem>
                <SelectItem value="meets_expectations">
                  Meets Expectations — Consistent Performer / Regular Increment
                </SelectItem>
                <SelectItem value="needs_improvement">
                  Needs Improvement — Performance Support Plan Recommended
                </SelectItem>
                <SelectItem value="unsatisfactory">
                  Unsatisfactory — Critical Action Required
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Detailed Feedback */}
          <div className="space-y-1.5">
            <Label htmlFor="mgr-feedback">
              Performance Review & Feedback <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="mgr-feedback"
              placeholder="Evaluate key deliverables, goal attainment, quality of work, and behavioral competencies..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>

          {/* Key Strengths */}
          <div className="space-y-1.5">
            <Label htmlFor="mgr-strengths">Key Strengths & Contributions</Label>
            <Textarea
              id="mgr-strengths"
              placeholder="What did this employee excel at during this period? Core capabilities demonstrated..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={2}
            />
          </div>

          {/* Development Plan */}
          <div className="space-y-1.5">
            <Label htmlFor="mgr-dev-plan">Development Plan & Training Needs</Label>
            <Textarea
              id="mgr-dev-plan"
              placeholder="Actionable steps, coaching, mentoring, or new responsibilities..."
              value={developmentPlan}
              onChange={(e) => setDevelopmentPlan(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitMutation.isPending ? "Submitting..." : "Save & Finalize Evaluation"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
