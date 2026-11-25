import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  Users,
  Star,
  CheckCircle2,
  Lock,
  Smile,
  MessageSquare,
  FileSpreadsheet,
} from "lucide-react";
import {
  EngagementSurvey,
  EngagementQuestion,
  calculateOptionDistribution,
  calculateAverageRating,
  calculateENPS,
} from "@/lib/engagement";

interface SurveyAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: EngagementSurvey | null;
  organizationId: string;
}

export function SurveyAnalyticsModal({
  open,
  onOpenChange,
  survey,
  organizationId,
}: SurveyAnalyticsModalProps) {
  // Fetch questions
  const { data: questions = [] } = useQuery({
    queryKey: ["survey-analytics-questions", survey?.id],
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

  // Fetch responses
  const { data: responses = [] } = useQuery({
    queryKey: ["survey-analytics-responses", survey?.id],
    queryFn: async () => {
      if (!survey?.id) return [];
      const { data, error } = await supabase
        .from("engagement_responses")
        .select(`
          id,
          submitted_at,
          is_anonymous,
          employee:employees!engagement_responses_employee_id_fkey(
            id,
            full_name,
            employee_code,
            department:departments(name)
          )
        `)
        .eq("survey_id", survey.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!survey?.id && open,
  });

  // Fetch answers
  const { data: answers = [], isLoading } = useQuery({
    queryKey: ["survey-analytics-answers", survey?.id],
    queryFn: async () => {
      if (!survey?.id) return [];
      const { data, error } = await supabase
        .from("engagement_answers")
        .select("*")
        .eq("survey_id", survey.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!survey?.id && open,
  });

  if (!survey) return null;

  const totalParticipants = responses.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs capitalize">
              {survey.type.replace("_", " ")}
            </Badge>
            <div className="flex items-center gap-2">
              {survey.is_anonymous && (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 gap-1">
                  <Lock className="h-3 w-3" /> Anonymous
                </Badge>
              )}
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" /> {totalParticipants} Participants
              </span>
            </div>
          </div>

          <DialogTitle className="text-lg font-bold text-foreground mt-1">
            {survey.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Comprehensive participation metrics, statistical distributions, and qualitative feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border bg-card space-y-1">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" /> Total Submissions
              </div>
              <div className="text-2xl font-bold text-foreground">
                {totalParticipants}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Verified unique submissions
              </p>
            </div>

            <div className="p-3.5 rounded-lg border bg-card space-y-1">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-emerald-500" /> Questions Measured
              </div>
              <div className="text-2xl font-bold text-foreground">
                {questions.length}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Target audience: {survey.target_audience === "department" ? "Department" : "All Employees"}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border bg-card space-y-1">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" /> Privacy Mode
              </div>
              <div className="text-sm font-bold text-foreground pt-1">
                {survey.is_anonymous ? "Strictly Anonymous" : "Named Respondents"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {survey.is_anonymous ? "Respondent identities withheld" : "Employee identity tracked"}
              </p>
            </div>
          </div>

          {/* Breakdown for each question */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Question-by-Question Response Analytics
            </h4>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Calculating analytics...
              </div>
            ) : questions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No questions found.
              </div>
            ) : (
              questions.map((q, idx) => {
                const qAnswers = answers.filter((a) => a.question_id === q.id);
                const options = Array.isArray(q.options) ? q.options : [];

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-lg border bg-card space-y-3.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {idx + 1}. {q.question_text}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                        {q.question_type.replace("_", " ")}
                      </Badge>
                    </div>

                    {/* Single or Multiple choice breakdown */}
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

                    {/* 1-5 Rating Scale */}
                    {q.question_type === "rating_scale" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-extrabold text-amber-500 flex items-center gap-1.5">
                            <Star className="h-7 w-7 fill-amber-500" />
                            {calculateAverageRating(
                              qAnswers.map((a) => Number(a.rating_value)).filter(Boolean)
                            )}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            out of 5.0 stars ({qAnswers.length} ratings recorded)
                          </div>
                        </div>

                        {/* Distribution 1 to 5 stars */}
                        <div className="space-y-1.5 pt-1">
                          {[5, 4, 3, 2, 1].map((s) => {
                            const count = qAnswers.filter((a) => Number(a.rating_value) === s).length;
                            const pct = qAnswers.length > 0 ? Math.round((count / qAnswers.length) * 100) : 0;
                            return (
                              <div key={s} className="flex items-center gap-2 text-xs">
                                <span className="w-14 text-muted-foreground">{s} Stars</span>
                                <Progress value={pct} className="h-2 flex-1" />
                                <span className="w-16 text-right font-semibold text-muted-foreground">
                                  {count} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* NPS Score Calculation */}
                    {q.question_type === "nps" && (
                      <div className="space-y-3 pt-1">
                        {(() => {
                          const nps = calculateENPS(
                            qAnswers.map((a) => Number(a.rating_value))
                          );
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="text-3xl font-extrabold text-foreground">
                                  {nps.score > 0 ? `+${nps.score}` : nps.score}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    nps.score >= 50
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : nps.score >= 20
                                      ? "bg-blue-500/10 text-blue-600"
                                      : nps.score >= 0
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-rose-500/10 text-rose-600"
                                  }`}
                                >
                                  {nps.score >= 50
                                    ? "World Class (50+)"
                                    : nps.score >= 20
                                    ? "Favorable (20-49)"
                                    : nps.score >= 0
                                    ? "Neutral (0-19)"
                                    : "Needs Attention (<0)"}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                                  <div className="text-lg font-bold text-emerald-600">
                                    {nps.promoterPct}%
                                  </div>
                                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                    Promoters ({nps.promoters})
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">Scores 9–10</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                  <div className="text-lg font-bold text-amber-600">
                                    {nps.passivePct}%
                                  </div>
                                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                    Passives ({nps.passives})
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">Scores 7–8</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                                  <div className="text-lg font-bold text-rose-600">
                                    {nps.detractorPct}%
                                  </div>
                                  <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                    Detractors ({nps.detractors})
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">Scores 0–6</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Boolean Yes / No */}
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

                    {/* Text Comments */}
                    {q.question_type === "text" && (
                      <div className="space-y-1.5 pt-1">
                        <div className="max-h-48 overflow-y-auto divide-y border rounded-lg p-2 bg-muted/20">
                          {qAnswers.filter((a) => a.answer_text).length === 0 ? (
                            <div className="text-center text-[11px] text-muted-foreground py-2">
                              No written comments submitted.
                            </div>
                          ) : (
                            qAnswers
                              .filter((a) => a.answer_text)
                              .map((a, aIdx) => (
                                <div key={aIdx} className="py-2 text-xs text-foreground">
                                  <span className="text-muted-foreground italic">"{a.answer_text}"</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
