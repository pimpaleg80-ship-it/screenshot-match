import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LmsQuiz, LmsQuizQuestion } from "@/lib/performance-lms";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Award,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface QuizPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  enrollmentId?: string | undefined;
  onQuizCompleted?: (passed: boolean) => void;
}

export function QuizPlayerModal({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  enrollmentId,
  onQuizCompleted,
}: QuizPlayerModalProps) {
  const queryClient = useQueryClient();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<{
    passed: boolean;
    scorePercent: number;
    correctCount: number;
    totalCount: number;
    certificateId?: string;
  } | null>(null);

  // Fetch Quiz & Questions for this course
  const { data: quiz, isLoading } = useQuery({
    queryKey: ["lms-course-quiz", courseId],
    enabled: open && Boolean(courseId),
    queryFn: async () => {
      const { data: qData, error: qErr } = await supabase
        .from("lms_quizzes" as any)
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();

      if (qErr || !qData) return null;

      const { data: questions, error: questErr } = await supabase
        .from("lms_quiz_questions" as any)
        .select("*")
        .eq("quiz_id", (qData as any).id)
        .order("order_index", { ascending: true });

      if (questErr) return null;

      return {
        ...(qData as any),
        questions: (questions ?? []) as unknown as LmsQuizQuestion[],
      } as LmsQuiz;
    },
  });

  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  // Submit Assessment Mutation
  const submitQuizMutation = useMutation({
    mutationFn: async () => {
      if (!quiz || !enrollmentId) {
        throw new Error("Missing active enrollment or quiz details");
      }

      // Convert answers map to JSON payload: [{ question_id, selected_option }]
      const answersPayload = Object.entries(selectedAnswers).map(
        ([question_id, selected_option]) => ({
          question_id,
          selected_option,
        })
      );

      const { data, error } = await supabase.rpc("submit_quiz_assessment", {
        p_enrollment_id: enrollmentId,
        p_quiz_id: quiz.id,
        p_answers: answersPayload as any,
      });

      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      setQuizResult({
        passed: data.passed,
        scorePercent: data.score_percent,
        correctCount: data.correct_answers,
        totalCount: data.total_questions,
        certificateId: data.certificate_id,
      });

      queryClient.invalidateQueries({ queryKey: ["lms-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["lms-certificates"] });
      queryClient.invalidateQueries({ queryKey: ["my-lms-learning"] });

      if (data.passed) {
        toast.success("Congratulations! You passed the quiz & earned a Certificate!");
      } else {
        toast.error("You did not reach the passing score. You can review and retake the quiz.");
      }

      if (onQuizCompleted) {
        onQuizCompleted(data.passed);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit assessment");
    },
  });

  const handleSelectOption = (optIndex: number) => {
    if (!currentQuestion) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optIndex,
    }));
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setQuizResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Assessment
            </Badge>
            <DialogTitle className="text-lg">{quiz?.title || "Course Knowledge Assessment"}</DialogTitle>
          </div>
          <DialogDescription className="line-clamp-1">{courseTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading quiz questions...</p>
          </div>
        ) : !quiz || totalQuestions === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <HelpCircle className="w-10 h-10 text-muted-foreground/60 mx-auto mb-2" />
            <h4 className="text-base font-semibold text-foreground">No Quiz Found</h4>
            <p className="text-xs text-muted-foreground mt-1">
              There is currently no assessment configured for this course.
            </p>
          </div>
        ) : quizResult ? (
          /* RESULT SCREEN */
          <div className="py-6 text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
                quizResult.passed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-2 border-rose-500/30"
              }`}
            >
              {quizResult.passed ? (
                <Award className="w-9 h-9" />
              ) : (
                <XCircle className="w-9 h-9" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">
                {quizResult.passed ? "Assessment Passed!" : "Assessment Incomplete"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Required passing score: {quiz.passing_score_percent}%
              </p>
            </div>

            <div className="bg-muted/40 p-4 rounded-lg border border-border inline-block min-w-[240px]">
              <div className="text-3xl font-bold text-foreground">
                {quizResult.scorePercent}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {quizResult.correctCount} out of {quizResult.totalCount} questions correct
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              {!quizResult.passed && (
                <Button variant="outline" size="sm" onClick={handleRetake} className="gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  <span>Retake Quiz</span>
                </Button>
              )}
              <Button size="sm" onClick={() => onOpenChange(false)}>
                {quizResult.passed ? "Back to Learning" : "Close"}
              </Button>
            </div>
          </div>
        ) : (
          /* ACTIVE QUESTION VIEW */
          <div className="space-y-5 py-2">
            {/* Progress & Indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <span>
                  Answered: {answeredCount} / {totalQuestions}
                </span>
              </div>
              <Progress
                value={((currentQuestionIndex + 1) / totalQuestions) * 100}
                className="h-2 rounded-full"
              />
            </div>

            {/* Question Text */}
            {currentQuestion && (
              <div className="space-y-4">
                <h4 className="text-base font-semibold text-foreground leading-snug">
                  {currentQuestion.question}
                </h4>

                {/* Options */}
                <div className="space-y-2.5">
                  {currentQuestion.options.map((optText, optIdx) => {
                    const isSelected = selectedAnswers[currentQuestion.id] === optIdx;
                    return (
                      <button
                        type="button"
                        key={optIdx}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-all text-sm flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary shadow-sm"
                            : "border-border hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? "bg-primary text-white border-primary"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{optText}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) =>
                      Math.min(totalQuestions - 1, prev + 1)
                    )
                  }
                  className="gap-1 text-xs"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => submitQuizMutation.mutate()}
                  disabled={submitQuizMutation.isPending || answeredCount < totalQuestions}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submitQuizMutation.isPending ? "Evaluating..." : "Submit Assessment"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
