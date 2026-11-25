import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PerformanceReview } from "@/lib/performance-lms";
import { Star, Award, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SelfAssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: PerformanceReview | null;
}

export function SelfAssessmentModal({
  open,
  onOpenChange,
  review,
}: SelfAssessmentModalProps) {
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number>(review?.self_rating || 4);
  const [achievements, setAchievements] = useState<string>("");
  const [growthAreas, setGrowthAreas] = useState<string>("");
  const [comments, setComments] = useState<string>("");

  useEffect(() => {
    if (review) {
      setRating(review.self_rating || 4);
      setAchievements(review.self_achievements || "");
      setGrowthAreas(review.self_growth_areas || "");
      setComments(review.self_comments || "");
    }
  }, [review]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!review) return;
      if (!rating || rating < 1 || rating > 5) {
        throw new Error("Please provide a self-rating between 1 and 5");
      }
      if (!achievements.trim()) {
        throw new Error("Please summarize your key achievements");
      }

      const { error } = await supabase.rpc("submit_self_assessment", {
        p_review_id: review.id,
        p_self_rating: rating,
        p_self_achievements: achievements.trim(),
        p_self_growth_areas: growthAreas.trim() || null,
        p_self_comments: comments.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Self-assessment submitted to your reporting manager");
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["my-performance-reviews"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit self-assessment");
    },
  });

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Award className="w-5 h-5 text-primary" />
            <span>Employee Self-Assessment</span>
          </DialogTitle>
          <DialogDescription>
            Cycle: {review.cycle?.title || review.review_period}. Reflect on your performance,
            accomplishments, and developmental aspirations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star Rating Selector */}
          <div className="space-y-2 bg-muted/40 p-3.5 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Self-Evaluation Rating (1 - 5)</Label>
              <span className="text-base font-bold text-primary">
                {rating.toFixed(1)} / 5.0
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-1.5 rounded-lg transition-transform hover:scale-110 ${
                    rating >= star
                      ? "text-amber-500 fill-amber-500"
                      : "text-muted-foreground/30 hover:text-amber-400"
                  }`}
                >
                  <Star className="w-7 h-7 fill-current" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {rating === 5 && "Outstanding — consistently exceeded expectations and drove high impact"}
              {rating === 4 && "Exceeds Expectations — delivered strong results beyond core KPIs"}
              {rating === 3 && "Meets Expectations — achieved standard targets reliably"}
              {rating === 2 && "Needs Improvement — several goals were missed or need attention"}
              {rating === 1 && "Unsatisfactory — immediate performance correction required"}
            </p>
          </div>

          {/* Key Achievements */}
          <div className="space-y-1.5">
            <Label htmlFor="self-achieve">
              Key Achievements & Deliverables <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="self-achieve"
              placeholder="Highlight major milestones, projects delivered, KPIs achieved, and value created..."
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              rows={4}
            />
          </div>

          {/* Growth Areas & Challenges */}
          <div className="space-y-1.5">
            <Label htmlFor="self-growth">Areas for Growth, Learning & Challenges</Label>
            <Textarea
              id="self-growth"
              placeholder="What skills would you like to develop? Any roadblocks or support needed from leadership?"
              value={growthAreas}
              onChange={(e) => setGrowthAreas(e.target.value)}
              rows={3}
            />
          </div>

          {/* Additional Comments */}
          <div className="space-y-1.5">
            <Label htmlFor="self-comments">Additional Comments for Manager</Label>
            <Textarea
              id="self-comments"
              placeholder="Any other notes, peer recognitions, or context..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
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
            <span>{submitMutation.isPending ? "Submitting..." : "Submit Self-Assessment"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
