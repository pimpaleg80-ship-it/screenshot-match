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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Plus,
  Trash2,
  Lock,
  Calendar,
  BarChart2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  SurveyType,
  QuestionType,
  SURVEY_TYPE_CONFIG,
} from "@/lib/engagement";

interface SurveyCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  userId: string;
}

interface NewQuestionItem {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  is_required: boolean;
  scale_min?: number;
  scale_max?: number;
}

export function SurveyCreationModal({
  open,
  onOpenChange,
  organizationId,
  userId,
}: SurveyCreationModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SurveyType>("poll");
  const [targetAudience, setTargetAudience] = useState<"all" | "department">("all");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showLiveResults, setShowLiveResults] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

  // Questions list
  const [questions, setQuestions] = useState<NewQuestionItem[]>([
    {
      id: "q-1",
      question_text: "",
      question_type: "single_choice",
      options: ["Strongly Agree", "Agree", "Neutral", "Disagree"],
      is_required: true,
      scale_min: 1,
      scale_max: 5,
    },
  ]);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["org-departments-for-survey", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Handle adding new question
  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        question_text: "",
        question_type: type === "satisfaction" ? "nps" : "single_choice",
        options: ["Option 1", "Option 2"],
        is_required: true,
        scale_min: 1,
        scale_max: 5,
      },
    ]);
  };

  // Handle removing question
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error("At least one question is required.");
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle question change
  const handleUpdateQuestion = (idx: number, updates: Partial<NewQuestionItem>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  };

  // Handle option change
  const handleAddOption = (qIdx: number) => {
    const q = questions[qIdx];
    if (!q) return;
    const newOpts = [...q.options, `Option ${q.options.length + 1}`];
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    const q = questions[qIdx];
    if (!q) return;
    const newOpts = [...q.options];
    newOpts[optIdx] = val;
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    if (!q) return;
    if (q.options.length <= 2) {
      toast.error("Choice questions need at least 2 options.");
      return;
    }
    const newOpts = q.options.filter((_, i) => i !== optIdx);
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Survey title is required.");
      if (targetAudience === "department" && !targetDepartmentId) {
        throw new Error("Please select the target department.");
      }

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q || !q.question_text.trim()) {
          throw new Error(`Question #${i + 1} text is required.`);
        }
        if (
          (q.question_type === "single_choice" || q.question_type === "multiple_choice") &&
          q.options.filter((o) => o.trim()).length < 2
        ) {
          throw new Error(`Question #${i + 1} must have at least 2 non-empty options.`);
        }
      }

      // 1. Insert Survey
      const { data: survey, error: surveyError } = await supabase
        .from("engagement_surveys")
        .insert({
          organization_id: organizationId,
          created_by_user_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          type,
          status: "active",
          target_audience: targetAudience,
          target_department_id: targetAudience === "department" ? targetDepartmentId : null,
          is_anonymous: isAnonymous,
          show_live_results: showLiveResults,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .select()
        .single();

      if (surveyError) throw surveyError;
      if (!survey) throw new Error("Failed to create survey.");

      // 2. Insert Questions
      const questionsPayload = questions.map((q, idx) => ({
        survey_id: survey.id,
        organization_id: organizationId,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options:
          q.question_type === "single_choice" || q.question_type === "multiple_choice"
            ? (q.options.map((o) => o.trim()).filter(Boolean) as any)
            : null,
        is_required: q.is_required,
        order_index: idx + 1,
        scale_min: q.question_type === "rating_scale" ? 1 : q.question_type === "nps" ? 0 : null,
        scale_max: q.question_type === "rating_scale" ? 5 : q.question_type === "nps" ? 10 : null,
      }));

      const { error: qError } = await supabase
        .from("engagement_questions")
        .insert(questionsPayload);

      if (qError) throw qError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement-surveys"] });
      toast.success("Survey published and active!");
      onOpenChange(false);
      // Reset form
      setTitle("");
      setDescription("");
      setQuestions([
        {
          id: "q-1",
          question_text: "",
          question_type: "single_choice",
          options: ["Option 1", "Option 2"],
          is_required: true,
          scale_min: 1,
          scale_max: 5,
        },
      ]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create survey.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Create Employee Survey or Poll
          </DialogTitle>
          <DialogDescription>
            Design feedback forms, quick polls, and pulse satisfaction surveys with cryptographic anonymity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title & Survey Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="srv-title">Survey Title *</Label>
              <Input
                id="srv-title"
                placeholder="Enter survey title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srv-type">Type</Label>
              <Select
                value={type}
                onValueChange={(val) => {
                  const newType = val as SurveyType;
                  setType(newType);
                  if (newType === "satisfaction") {
                    setQuestions([
                      {
                        id: "q-1",
                        question_text: "How likely are you to recommend FlowPeople as a great place to work?",
                        question_type: "nps",
                        options: [],
                        is_required: true,
                        scale_min: 0,
                        scale_max: 10,
                      },
                      {
                        id: "q-2",
                        question_text: "What is the primary reason for your score?",
                        question_type: "text",
                        options: [],
                        is_required: false,
                      },
                    ]);
                  } else if (newType === "poll") {
                    setQuestions([
                      {
                        id: "q-1",
                        question_text: "",
                        question_type: "single_choice",
                        options: ["Yes", "No", "Maybe"],
                        is_required: true,
                      },
                    ]);
                  }
                }}
              >
                <SelectTrigger id="srv-type">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SURVEY_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="srv-desc">Description / Instructions</Label>
            <Textarea
              id="srv-desc"
              rows={2}
              placeholder="Explain the purpose of this survey, context, or how feedback will be acted upon..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Audience & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="srv-audience">Target Audience</Label>
              <Select
                value={targetAudience}
                onValueChange={(val: any) => setTargetAudience(val)}
              >
                <SelectTrigger id="srv-audience">
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organization Employees</SelectItem>
                  <SelectItem value="department">Department-Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetAudience === "department" ? (
              <div className="space-y-1.5">
                <Label htmlFor="srv-dept">Target Department *</Label>
                <Select
                  value={targetDepartmentId}
                  onValueChange={setTargetDepartmentId}
                >
                  <SelectTrigger id="srv-dept">
                    <SelectValue placeholder="Choose Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="srv-start">Start Date</Label>
                <Input
                  id="srv-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="srv-end">End Date (Optional)</Label>
              <Input
                id="srv-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Anonymity & Live Results Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  Anonymous Responses
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Respondent profile is completely stripped. Administrators will never see respondent identities.
                </p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>

            <div className="p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Live Results for Employees
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Respondents can see aggregated poll distributions immediately after voting.
                </p>
              </div>
              <Switch checked={showLiveResults} onCheckedChange={setShowLiveResults} />
            </div>
          </div>

          {/* Questions Builder */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Questions ({questions.length})
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddQuestion}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-lg border bg-card space-y-3.5 shadow-sm relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      Question #{qIdx + 1}
                    </span>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 mr-2">
                        <Switch
                          id={`req-${q.id}`}
                          checked={q.is_required}
                          onCheckedChange={(val) =>
                            handleUpdateQuestion(qIdx, { is_required: val })
                          }
                        />
                        <Label htmlFor={`req-${q.id}`} className="text-xs text-muted-foreground cursor-pointer">
                          Required
                        </Label>
                      </div>

                      {questions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveQuestion(qIdx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <Input
                        placeholder="Enter your question here..."
                        value={q.question_text}
                        onChange={(e) =>
                          handleUpdateQuestion(qIdx, { question_text: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Select
                        value={q.question_type}
                        onValueChange={(val: any) =>
                          handleUpdateQuestion(qIdx, { question_type: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Question Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">Single Choice (Radio)</SelectItem>
                          <SelectItem value="multiple_choice">Multiple Choice (Checkboxes)</SelectItem>
                          <SelectItem value="rating_scale">1-5 Rating Stars</SelectItem>
                          <SelectItem value="nps">0-10 Net Promoter Score</SelectItem>
                          <SelectItem value="boolean">Yes / No</SelectItem>
                          <SelectItem value="text">Open Text Feedback</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Options builder for Single / Multiple choice */}
                  {(q.question_type === "single_choice" ||
                    q.question_type === "multiple_choice") && (
                    <div className="space-y-2 pt-1 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Answer Options
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-primary gap-1"
                          onClick={() => handleAddOption(qIdx)}
                        >
                          <Plus className="h-3 w-3" /> Add Option
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">
                              {optIdx + 1}.
                            </span>
                            <Input
                              value={opt}
                              className="h-8 text-xs"
                              placeholder={`Option ${optIdx + 1}`}
                              onChange={(e) =>
                                handleUpdateOption(qIdx, optIdx, e.target.value)
                              }
                            />
                            {q.options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                onClick={() => handleRemoveOption(qIdx, optIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="gap-1.5"
          >
            {createMutation.isPending ? "Creating..." : "Publish Survey / Poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
