import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Star, Award, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CandidateInterview } from "@/lib/recruitment";

interface InterviewFeedbackModalProps {
  interview: CandidateInterview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InterviewFeedbackModal({
  interview,
  open,
  onOpenChange,
  onSuccess,
}: InterviewFeedbackModalProps) {
  const [rating, setRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<string>("hire");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!interview) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toast.error("Please provide interview evaluation feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_interview_feedback", {
        p_interview_id: interview.id,
        p_rating: rating,
        p_recommendation: recommendation,
        p_strengths: strengths.trim() || null,
        p_weaknesses: weaknesses.trim() || null,
        p_feedback: feedback.trim() || null,
      });

      if (error) throw error;

      toast.success("Interview evaluation submitted successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Submit feedback error:", err);
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Interview Evaluation Scorecard</span>
          </DialogTitle>
          <DialogDescription>
            Submit rating and recommendation for{" "}
            <span className="font-semibold text-foreground">
              {interview.candidate?.full_name || "Candidate"}
            </span>{" "}
            • {interview.round_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Star Rating 1-5 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Candidate Score ({rating}/5)
            </Label>
            <div className="flex items-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 rounded-md hover:bg-muted/60 transition"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Hiring Recommendation */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hiring Decision Recommendation
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "strong_hire", label: "Strong Hire", color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
                { key: "hire", label: "Hire", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
                { key: "hold", label: "Hold / Maybe", color: "text-amber-700 bg-amber-500/10 border-amber-500/30" },
                { key: "reject", label: "Reject", color: "text-rose-700 bg-rose-500/10 border-rose-500/30" },
              ].map((rec) => (
                <button
                  key={rec.key}
                  type="button"
                  onClick={() => setRecommendation(rec.key)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition text-left ${
                    recommendation === rec.key
                      ? `${rec.color} ring-2 ring-primary/30`
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Strengths */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-strengths">Key Strengths Demonstrated</Label>
            <Input
              id="fb-strengths"
              placeholder="e.g. Clean code, deep DB indexing knowledge, articulate communication"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>

          {/* Weaknesses / Concerns */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-weaknesses">Areas of Concern / Gaps</Label>
            <Input
              id="fb-weaknesses"
              placeholder="e.g. Limited cloud deployment experience, vague on concurrency"
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
            />
          </div>

          {/* Evaluation Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-notes">Overall Evaluation & Notes *</Label>
            <Textarea
              id="fb-notes"
              rows={3}
              placeholder="Provide a detailed assessment of technical proficiency, problem-solving approach, and fit..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Scorecard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
