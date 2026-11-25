import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardCheck,
  Lock,
  Star,
  CheckCircle2,
  BarChart2,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  EngagementSurvey,
  EngagementQuestion,
  calculateOptionDistribution,
  calculateAverageRating,
  calculateENPS,
} from "@/lib/engagement";

interface SurveyResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: EngagementSurvey | null;
  employeeId: string;
}

export function SurveyResponseModal({
  open,
  onOpenChange,
  survey,
  employeeId,
}: SurveyResponseModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"form" | "results">("form");

  // State for responses: { [questionId]: { text?: string, options?: string[], rating?: number, boolean?: boolean } }
  const [answersState, setAnswersState] = useState<Record<string, any>>({});

  // 1. Fetch questions for this survey
  const { data: questions = [], isLoading: qLoading } = useQuery({
    queryKey: ["survey-questions", survey?.id],
    queryFn: async () => {
      if (!survey?.id) return [];
      const { data, error } = await supabase
        .from("engagement_questions")
        .select("*")
        .eq("survey_id", survey.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as EngagementQuestion[];
    },
    enabled: !!survey?.id && open,
  });

  // 2. Fetch live results / answers for this survey (if show_live_results is true)
  const { data: answersData = [] } = useQuery({
    queryKey: ["survey-live-answers", survey?.id],
    queryFn: async () => {
      if (!survey?.id) return [];
      const { data, error } = await supabase
        .from("engagement_answers")
        .select("*")
        .eq("survey_id", survey.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!survey?.id && open && (activeTab === "results" || survey.show_live_results),
  });

  // Submit response mutation using the PostgreSQL RPC
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!survey?.id) throw new Error("Invalid survey.");
      if (!employeeId) throw new Error("Employee identity required to participate.");

      // Check required questions
      for (const q of questions) {
        if (q.is_required) {
          const ans = answersState[q.id];
          if (!ans) {
            throw new Error(`Please answer: "${q.question_text}"`);
          }
          if (q.question_type === "single_choice" && !ans.answer_text) {
            throw new Error(`Please select an option for: "${q.question_text}"`);
          }
          if (
            q.question_type === "multiple_choice" &&
            (!ans.selected_options || ans.selected_options.length === 0)
          ) {
            throw new Error(`Please select at least one option for: "${q.question_text}"`);
          }
          if (
            (q.question_type === "rating_scale" || q.question_type === "nps") &&
            ans.rating_value === undefined
          ) {
            throw new Error(`Please provide a rating for: "${q.question_text}"`);
          }
          if (q.question_type === "text" && !ans.answer_text?.trim()) {
            throw new Error(`Please fill out: "${q.question_text}"`);
          }
          if (q.question_type === "boolean" && ans.boolean_value === undefined) {
            throw new Error(`Please choose Yes or No for: "${q.question_text}"`);
          }
        }
      }

      // Prepare answers payload
      const formattedAnswers = questions.map((q) => {
        const state = answersState[q.id] || {};
        return {
          question_id: q.id,
          answer_text: state.answer_text || null,
          selected_options: state.selected_options || [],
          rating_value: state.rating_value ?? null,
          boolean_value: state.boolean_value ?? null,
        };
      });

      const { data, error } = await supabase.rpc(
        "submit_engagement_survey_response" as any,
        {
          _survey_id: survey.id,
          _employee_id: employeeId,
          _answers: formattedAnswers as any,
        }
      );

      if (error) throw error;
      const res = data as any;
      if (!res.success) throw new Error(res.error || "Failed to submit survey.");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement-surveys"] });
      queryClient.invalidateQueries({ queryKey: ["survey-live-answers"] });
      toast.success(
        survey?.is_anonymous
          ? "Anonymous response submitted securely!"
          : "Thank you for your feedback!"
      );
      if (survey?.show_live_results) {
        setActiveTab("results");
      } else {
        onOpenChange(false);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit survey.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs uppercase tracking-wider">
              {survey?.type?.replace("_", " ")}
            </Badge>

            {survey?.show_live_results && (
              <div className="flex items-center gap-1">
                <Button
                  variant={activeTab === "form" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveTab("form")}
                >
                  Questionnaire
                </Button>
                <Button
                  variant={activeTab === "results" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setActiveTab("results")}
                >
                  <BarChart2 className="h-3.5 w-3.5" /> Live Results
                </Button>
              </div>
            )}
          </div>

          <DialogTitle className="text-lg font-bold text-foreground mt-1">
            {survey?.title}
          </DialogTitle>
          {survey?.description && (
            <DialogDescription className="text-xs">
              {survey.description}
            </DialogDescription>
          )}

          {survey?.is_anonymous && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs mt-2">
              <Lock className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong>Anonymous Participation:</strong> Your response is cryptographically unlinked from your employee profile. Administrators will never see who submitted this response.
              </span>
            </div>
          )}
        </DialogHeader>

        {activeTab === "form" ? (
          <div className="space-y-6 py-3">
            {qLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading questions...
              </div>
            ) : questions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No questions found in this survey.
              </div>
            ) : (
              questions.map((q, idx) => {
                const ans = answersState[q.id] || {};
                const options = Array.isArray(q.options) ? q.options : [];

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-lg border bg-card space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-sm font-semibold text-foreground">
                        {idx + 1}. {q.question_text}
                        {q.is_required && (
                          <span className="text-rose-500 ml-1">*</span>
                        )}
                      </Label>
                    </div>

                    {/* Single Choice Radio */}
                    {q.question_type === "single_choice" && (
                      <RadioGroup
                        value={ans.answer_text || ""}
                        onValueChange={(val) =>
                          setAnswersState((prev) => ({
                            ...prev,
                            [q.id]: { ...prev[q.id], answer_text: val },
                          }))
                        }
                        className="space-y-2 pt-1"
                      >
                        {options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className="flex items-center space-x-2.5 p-2 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer"
                            onClick={() =>
                              setAnswersState((prev) => ({
                                ...prev,
                                [q.id]: { ...prev[q.id], answer_text: opt },
                              }))
                            }
                          >
                            <RadioGroupItem value={opt} id={`${q.id}-${oIdx}`} />
                            <Label
                              htmlFor={`${q.id}-${oIdx}`}
                              className="text-xs font-normal text-foreground cursor-pointer flex-1"
                            >
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Multiple Choice Checkboxes */}
                    {q.question_type === "multiple_choice" && (
                      <div className="space-y-2 pt-1">
                        {options.map((opt, oIdx) => {
                          const selected = (ans.selected_options || []).includes(opt);
                          return (
                            <div
                              key={oIdx}
                              className="flex items-center space-x-2.5 p-2 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer"
                              onClick={() => {
                                const current = ans.selected_options || [];
                                const updated = selected
                                  ? current.filter((o: string) => o !== opt)
                                  : [...current, opt];
                                setAnswersState((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...prev[q.id],
                                    selected_options: updated,
                                  },
                                }));
                              }}
                            >
                              <Checkbox checked={selected} />
                              <Label className="text-xs font-normal text-foreground cursor-pointer flex-1">
                                {opt}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 1-5 Rating Stars */}
                    {q.question_type === "rating_scale" && (
                      <div className="flex items-center gap-2 pt-1">
                        {[1, 2, 3, 4, 5].map((starVal) => {
                          const isSelected = ans.rating_value >= starVal;
                          return (
                            <button
                              key={starVal}
                              type="button"
                              onClick={() =>
                                setAnswersState((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...prev[q.id],
                                    rating_value: starVal,
                                  },
                                }))
                              }
                              className={`p-2 rounded-lg border transition-all ${
                                isSelected
                                  ? "bg-amber-500/10 border-amber-300 text-amber-500 scale-105"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  isSelected ? "fill-amber-500" : ""
                                }`}
                              />
                            </button>
                          );
                        })}
                        {ans.rating_value && (
                          <span className="text-xs font-semibold text-amber-600 ml-2">
                            {ans.rating_value} of 5 Stars
                          </span>
                        )}
                      </div>
                    )}

                    {/* 0-10 Net Promoter Score */}
                    {q.question_type === "nps" && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-11 gap-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                            const isSelected = ans.rating_value === num;
                            const isDetractor = num <= 6;
                            const isPassive = num === 7 || num === 8;
                            const isPromoter = num >= 9;

                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() =>
                                  setAnswersState((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      ...prev[q.id],
                                      rating_value: num,
                                    },
                                  }))
                                }
                                className={`h-9 rounded-md border text-xs font-bold transition-all ${
                                  isSelected
                                    ? isPromoter
                                      ? "bg-emerald-600 text-white border-emerald-600 scale-105 shadow-sm"
                                      : isPassive
                                      ? "bg-amber-600 text-white border-amber-600 scale-105 shadow-sm"
                                      : "bg-rose-600 text-white border-rose-600 scale-105 shadow-sm"
                                    : "border-border text-foreground hover:bg-muted"
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                          <span>0 - Not At All Likely</span>
                          <span>10 - Extremely Likely</span>
                        </div>
                      </div>
                    )}

                    {/* Boolean Yes / No */}
                    {q.question_type === "boolean" && (
                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant={ans.boolean_value === true ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setAnswersState((prev) => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], boolean_value: true },
                            }))
                          }
                          className="w-24 text-xs"
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={ans.boolean_value === false ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setAnswersState((prev) => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], boolean_value: false },
                            }))
                          }
                          className="w-24 text-xs"
                        >
                          No
                        </Button>
                      </div>
                    )}

                    {/* Open Text */}
                    {q.question_type === "text" && (
                      <div className="pt-1">
                        <Textarea
                          rows={3}
                          placeholder="Type your response here..."
                          value={ans.answer_text || ""}
                          onChange={(e) =>
                            setAnswersState((prev) => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], answer_text: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Live Results View */
          <div className="space-y-5 py-3">
            <div className="p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                Live Responses Count
              </span>
              <span className="font-bold text-primary">
                {new Set(answersData.map((a) => a.response_id)).size} Participants
              </span>
            </div>

            {questions.map((q, idx) => {
              const qAnswers = answersData.filter((a) => a.question_id === q.id);
              const options = Array.isArray(q.options) ? q.options : [];

              return (
                <div key={q.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <h5 className="text-xs font-bold text-foreground">
                    {idx + 1}. {q.question_text}
                  </h5>

                  {(q.question_type === "single_choice" ||
                    q.question_type === "multiple_choice") && (
                    <div className="space-y-2 pt-1">
                      {calculateOptionDistribution(qAnswers, options).map((item, oIdx) => (
                        <div key={oIdx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground">{item.option}</span>
                            <span className="font-semibold text-muted-foreground">
                              {item.count} votes ({item.percentage}%)
                            </span>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "rating_scale" && (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-amber-500 flex items-center gap-1.5">
                        <Star className="h-6 w-6 fill-amber-500" />
                        {calculateAverageRating(
                          qAnswers.map((a) => Number(a.rating_value)).filter(Boolean)
                        )}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          / 5.0 Average ({qAnswers.length} ratings)
                        </span>
                      </div>
                    </div>
                  )}

                  {q.question_type === "nps" && (
                    <div className="space-y-2">
                      {(() => {
                        const nps = calculateENPS(
                          qAnswers.map((a) => Number(a.rating_value))
                        );
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-extrabold text-foreground">
                                {nps.score > 0 ? `+${nps.score}` : nps.score}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  nps.score >= 30
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : nps.score >= 0
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-rose-500/10 text-rose-600"
                                }`}
                              >
                                {nps.score >= 50
                                  ? "Excellent"
                                  : nps.score >= 20
                                  ? "Good"
                                  : nps.score >= 0
                                  ? "Neutral"
                                  : "Needs Action"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-center">
                              <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                                <div className="font-bold text-emerald-600">
                                  {nps.promoterPct}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Promoters (9-10)
                                </div>
                              </div>
                              <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                                <div className="font-bold text-amber-600">
                                  {nps.passivePct}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Passives (7-8)
                                </div>
                              </div>
                              <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200">
                                <div className="font-bold text-rose-600">
                                  {nps.detractorPct}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Detractors (0-6)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {q.question_type === "boolean" && (
                    <div className="space-y-1.5 pt-1">
                      {(() => {
                        const yesCount = qAnswers.filter((a) => a.boolean_value === true).length;
                        const noCount = qAnswers.filter((a) => a.boolean_value === false).length;
                        const total = yesCount + noCount;
                        const yesPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
                        const noPct = total > 0 ? Math.round((noCount / total) * 100) : 0;

                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-foreground">Yes</span>
                              <span className="font-semibold text-muted-foreground">
                                {yesCount} ({yesPct}%)
                              </span>
                            </div>
                            <Progress value={yesPct} className="h-2" />
                            <div className="flex justify-between text-xs pt-1">
                              <span className="text-foreground">No</span>
                              <span className="font-semibold text-muted-foreground">
                                {noCount} ({noPct}%)
                              </span>
                            </div>
                            <Progress value={noPct} className="h-2" />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {q.question_type === "text" && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto divide-y border rounded-lg p-2 bg-muted/20">
                      {qAnswers.filter((a) => a.answer_text).length === 0 ? (
                        <div className="text-center text-[11px] text-muted-foreground py-2">
                          No text comments yet.
                        </div>
                      ) : (
                        qAnswers
                          .filter((a) => a.answer_text)
                          .map((a, aIdx) => (
                            <div key={aIdx} className="py-1.5 text-xs text-foreground">
                              "{a.answer_text}"
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {activeTab === "form" && (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "Submitting..." : "Submit Response"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
