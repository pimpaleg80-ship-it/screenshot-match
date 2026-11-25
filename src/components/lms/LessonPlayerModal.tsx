import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LmsCourse,
  LmsModule,
  getSecureLearningMaterialUrl,
  formatCourseDuration,
} from "@/lib/performance-lms";
import { QuizPlayerModal } from "./QuizPlayerModal";
import {
  Play,
  FileText,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Award,
  Video,
  Download,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface LessonPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: LmsCourse | null;
  enrollmentId?: string | undefined;
  onCourseCompleted?: () => void;
}

export function LessonPlayerModal({
  open,
  onOpenChange,
  course,
  enrollmentId,
  onCourseCompleted,
}: LessonPlayerModalProps) {
  const queryClient = useQueryClient();

  const [activeModuleId, setActiveModuleId] = useState<string>("");
  const [signedDocUrl, setSignedDocUrl] = useState<string | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  // Fetch course modules
  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["lms-course-modules", course?.id],
    enabled: open && Boolean(course?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_modules" as any)
        .select("*")
        .eq("course_id", course!.id)
        .order("sequence_order", { ascending: true });

      if (error) return [];
      return (data ?? []) as unknown as LmsModule[];
    },
  });

  // Fetch completed progress for this enrollment
  const { data: progressRecords = [], isLoading: loadingProgress } = useQuery({
    queryKey: ["lms-lesson-progress", enrollmentId],
    enabled: open && Boolean(enrollmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_lesson_progress" as any)
        .select("module_id, completed")
        .eq("enrollment_id", enrollmentId!)
        .eq("completed", true);

      if (error) return [];
      return data ?? [];
    },
  });

  const completedModuleIds = new Set(progressRecords.map((r: any) => r.module_id));

  // Default active module to first incomplete module or first module
  useEffect(() => {
    if (modules.length > 0 && !activeModuleId) {
      const firstIncomplete = modules.find((m) => !completedModuleIds.has(m.id));
      setActiveModuleId(firstIncomplete ? firstIncomplete.id : modules[0]?.id || "");
    }
  }, [modules, completedModuleIds, activeModuleId]);

  const activeModule =
    modules.find((m) => m.id === activeModuleId) || modules[0] || null;

  // Resolve signed URL for document material if needed
  useEffect(() => {
    let isMounted = true;
    async function loadMaterialUrl() {
      if (activeModule?.file_path) {
        const url = await getSecureLearningMaterialUrl(activeModule.file_path);
        if (isMounted) setSignedDocUrl(url);
      } else {
        if (isMounted) setSignedDocUrl(null);
      }
    }
    loadMaterialUrl();
    return () => {
      isMounted = false;
    };
  }, [activeModule]);

  // Mark module complete mutation
  const completeModuleMutation = useMutation({
    mutationFn: async () => {
      if (!enrollmentId || !activeModule) return;

      const { data, error } = await supabase.rpc("complete_lesson_module", {
        p_enrollment_id: enrollmentId,
        p_module_id: activeModule.id,
      });

      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      toast.success(`Completed lesson: ${activeModule?.title}`);
      queryClient.invalidateQueries({ queryKey: ["lms-lesson-progress"] });
      queryClient.invalidateQueries({ queryKey: ["lms-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["my-lms-learning"] });

      if (data?.is_completed) {
        toast.success("Course 100% completed! Ready for assessment or certificate!");
        if (onCourseCompleted) onCourseCompleted();
      }

      // Move to next module if available
      const currentIndex = modules.findIndex((m) => m.id === activeModule?.id);
      if (currentIndex !== -1 && currentIndex < modules.length - 1) {
        const nextMod = modules[currentIndex + 1];
        if (nextMod) setActiveModuleId(nextMod.id);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark lesson complete");
    },
  });

  if (!course) return null;

  const totalModules = modules.length;
  const completedCount = modules.filter((m) => completedModuleIds.has(m.id)).length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[88vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px]">
                  {course.category}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatCourseDuration(course.estimated_duration_minutes)}
                </span>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate mt-0.5">
                {course.title}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-muted-foreground">Course Progress</p>
                <p className="text-sm font-bold text-foreground">{progressPercent}%</p>
              </div>
              <Progress value={progressPercent} className="w-24 h-2 rounded-full hidden sm:block" />
            </div>
          </div>

          {/* Main Workspace: Left Curriculum / Right Content Player */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar Modules List */}
            <div className="w-full md:w-80 border-r border-border bg-muted/20 overflow-y-auto p-3 space-y-1.5 shrink-0 max-h-48 md:max-h-full">
              <p className="text-xs font-bold text-muted-foreground uppercase px-2 mb-2">
                Curriculum ({completedCount}/{totalModules} completed)
              </p>

              {modules.map((m, idx) => {
                const isCompleted = completedModuleIds.has(m.id);
                const isActive = m.id === activeModule?.id;

                let Icon = BookOpen;
                if (m.content_type === "video") Icon = Video;
                else if (m.content_type === "document") Icon = FileText;
                else if (m.content_type === "quiz") Icon = HelpCircle;

                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setActiveModuleId(m.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40 shadow-xs"
                        : "border-transparent hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                          isCompleted
                            ? "bg-emerald-500 text-white font-bold"
                            : "bg-muted text-muted-foreground font-medium"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </span>
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span className="truncate">{m.title}</span>
                    </div>

                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {m.duration_minutes}m
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content Display Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-between space-y-6">
              {activeModule ? (
                <div className="space-y-4">
                  {/* Lesson Title & Type */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {activeModule.content_type} Lesson
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Duration: {activeModule.duration_minutes} minutes
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {activeModule.title}
                    </h2>
                    {activeModule.description && (
                      <p className="text-xs text-muted-foreground">
                        {activeModule.description}
                      </p>
                    )}
                  </div>

                  {/* VIDEO PLAYER */}
                  {activeModule.content_type === "video" && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-inner flex items-center justify-center">
                      {activeModule.content_url?.includes("youtube") ||
                      activeModule.content_url?.includes("youtu.be") ? (
                        <iframe
                          src={activeModule.content_url.replace("watch?v=", "embed/")}
                          title={activeModule.title}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : activeModule.content_url ? (
                        <video
                          src={activeModule.content_url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-zinc-400 p-6">
                          <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Video lesson ready for streaming</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DOCUMENT PREVIEW */}
                  {activeModule.content_type === "document" && (
                    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <FileText className="w-5 h-5 text-primary" />
                          <span>Training Document / Reference Material</span>
                        </div>
                        {(signedDocUrl || activeModule.content_url) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() =>
                              window.open(signedDocUrl || activeModule.content_url || "", "_blank")
                            }
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Fullscreen</span>
                          </Button>
                        )}
                      </div>

                      {signedDocUrl || activeModule.content_url ? (
                        <iframe
                          src={signedDocUrl || activeModule.content_url || ""}
                          title={activeModule.title}
                          className="w-full h-96 border rounded-lg bg-white"
                        />
                      ) : (
                        <div className="p-10 text-center text-muted-foreground border border-dashed rounded-lg">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Document material preview not available.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ARTICLE TEXT */}
                  {activeModule.content_type === "article" && (
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-card p-5 rounded-lg border border-border">
                      <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                        {activeModule.text_content ||
                          "Read through the assigned article notes and reference materials before proceeding to the next lesson."}
                      </div>
                    </div>
                  )}

                  {/* QUIZ LAUNCHER */}
                  {activeModule.content_type === "quiz" && (
                    <div className="bg-muted/30 border border-border rounded-lg p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto">
                        <HelpCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Course Assessment Quiz</h3>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Test your understanding of the training content. Passing score:{" "}
                        {course.passing_score_percent}%. Successfully passing will unlock your official certificate.
                      </p>
                      <Button
                        onClick={() => setQuizModalOpen(true)}
                        className="gap-2 bg-primary text-white font-semibold"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Launch Assessment Quiz</span>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <p>Select a lesson from the curriculum sidebar to begin.</p>
                </div>
              )}

              {/* Bottom Navigation & Complete Action */}
              {activeModule && (
                <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={modules.findIndex((m) => m.id === activeModule.id) === 0}
                    onClick={() => {
                      const idx = modules.findIndex((m) => m.id === activeModule.id);
                      if (idx > 0 && modules[idx - 1]) setActiveModuleId(modules[idx - 1]!.id);
                    }}
                    className="gap-1 text-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>

                  {completedModuleIds.has(activeModule.id) ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lesson Completed</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => completeModuleMutation.mutate()}
                      disabled={completeModuleMutation.isPending}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {completeModuleMutation.isPending
                          ? "Marking..."
                          : "Mark Complete & Continue"}
                      </span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      modules.findIndex((m) => m.id === activeModule.id) ===
                      modules.length - 1
                    }
                    onClick={() => {
                      const idx = modules.findIndex((m) => m.id === activeModule.id);
                      if (idx < modules.length - 1 && modules[idx + 1]) {
                        setActiveModuleId(modules[idx + 1]!.id);
                      }
                    }}
                    className="gap-1 text-xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QUIZ PLAYER MODAL */}
      <QuizPlayerModal
        open={quizModalOpen}
        onOpenChange={setQuizModalOpen}
        courseId={course.id}
        courseTitle={course.title}
        enrollmentId={enrollmentId}
        onQuizCompleted={(passed) => {
          if (passed && onCourseCompleted) onCourseCompleted();
        }}
      />
    </>
  );
}
