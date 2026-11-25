import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CourseLevel } from "@/lib/performance-lms";
import { BookOpen, Plus, Trash2, Video, FileText, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface CourseCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ModuleDraft {
  title: string;
  description: string;
  content_type: "video" | "document" | "article" | "quiz";
  content_url?: string;
  text_content?: string;
  duration_minutes: number;
}

export function CourseCreatorModal({
  open,
  onOpenChange,
}: CourseCreatorModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Engineering");
  const [level, setLevel] = useState<CourseLevel>("intermediate");
  const [estimatedDuration, setEstimatedDuration] = useState("60");
  const [passingScore, setPassingScore] = useState("80");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const [modules, setModules] = useState<ModuleDraft[]>([
    {
      title: "Introduction & Foundations",
      description: "Overview of core concepts and principles",
      content_type: "article",
      text_content: "Welcome to this training module. Please review the key tenets and guidelines outlined below...",
      duration_minutes: 15,
    },
  ]);

  const addModule = () => {
    setModules((prev) => [
      ...prev,
      {
        title: `Module ${prev.length + 1}`,
        description: "",
        content_type: "article",
        duration_minutes: 15,
      },
    ]);
  };

  const removeModule = (index: number) => {
    setModules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateModule = (index: number, field: keyof ModuleDraft, value: any) => {
    setModules((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, [field]: value };
      }
      return copy;
    });
  };

  const createCourseMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Course title is required");

      // 1. Insert course
      const { data: course, error: courseError } = await supabase
        .from("lms_courses" as any)
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim(),
          level,
          estimated_duration_minutes: Number(estimatedDuration) || 60,
          passing_score_percent: Number(passingScore) || 80,
          thumbnail_url: thumbnailUrl.trim() || null,
          status: "published",
        } as any)
        .select()
        .single();

      if (courseError) throw courseError;

      // 2. Insert modules
      if (modules.length > 0) {
        const modulesPayload = modules.map((m, idx) => ({
          course_id: (course as any).id,
          title: m.title.trim() || `Module ${idx + 1}`,
          description: m.description.trim() || null,
          content_type: m.content_type,
          content_url: m.content_url?.trim() || null,
          text_content: m.text_content?.trim() || null,
          duration_minutes: Number(m.duration_minutes) || 15,
          sequence_order: idx + 1,
        }));

        const { error: modulesError } = await supabase
          .from("lms_modules" as any)
          .insert(modulesPayload as any);

        if (modulesError) throw modulesError;
      }

      return course;
    },
    onSuccess: () => {
      toast.success("Training course created and published");
      queryClient.invalidateQueries({ queryKey: ["lms-courses"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create course");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("Engineering");
    setLevel("intermediate");
    setEstimatedDuration("60");
    setPassingScore("80");
    setThumbnailUrl("");
    setModules([
      {
        title: "Introduction & Foundations",
        description: "Overview of core concepts and principles",
        content_type: "article",
        duration_minutes: 15,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Create New Training Course</span>
          </DialogTitle>
          <DialogDescription>
            Author curriculum, lessons, and learning material for employee self-service and corporate upskilling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="c-title">
              Course Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="c-title"
              placeholder="e.g. Advanced TypeScript Architecture, Cyber Security Essentials"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description & Learning Outcomes</Label>
            <Textarea
              id="c-desc"
              placeholder="What competencies and knowledge will employees gain from this course?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Category, Level, Duration, Passing Score */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Security & Compliance">Security</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Product & Design">Design</SelectItem>
                  <SelectItem value="HR & Leadership">Leadership</SelectItem>
                  <SelectItem value="Sales & Support">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Skill Level</Label>
              <Select value={level} onValueChange={(v: CourseLevel) => setLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="all_levels">All Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-dur">Est. Minutes</Label>
              <Input
                id="c-dur"
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-pass">Pass Score (%)</Label>
              <Input
                id="c-pass"
                type="number"
                min="50"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>
          </div>

          {/* Curriculum Builder */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Curriculum Modules & Lessons</Label>
                <p className="text-xs text-muted-foreground">Add video, article, or document lessons.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addModule}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lesson</span>
              </Button>
            </div>

            <div className="space-y-3">
              {modules.map((mod, index) => (
                <div
                  key={index}
                  className="bg-muted/30 border border-border rounded-lg p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary">Lesson #{index + 1}</span>
                    {modules.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-700"
                        onClick={() => removeModule(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Lesson Title</Label>
                      <Input
                        placeholder="Title"
                        value={mod.title}
                        onChange={(e) => updateModule(index, "title", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Content Type</Label>
                      <Select
                        value={mod.content_type}
                        onValueChange={(v: any) => updateModule(index, "content_type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="article">Reading Article</SelectItem>
                          <SelectItem value="video">Video URL</SelectItem>
                          <SelectItem value="document">Document / PDF</SelectItem>
                          <SelectItem value="quiz">Assessment Quiz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {mod.content_type === "video" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Video Stream URL (YouTube, Vimeo, MP4)</Label>
                      <Input
                        placeholder="https://..."
                        value={mod.content_url || ""}
                        onChange={(e) => updateModule(index, "content_url", e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}

                  {mod.content_type === "article" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Article Content / Notes</Label>
                      <Textarea
                        placeholder="Lesson notes, code examples, guidance..."
                        value={mod.text_content || ""}
                        onChange={(e) => updateModule(index, "text_content", e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createCourseMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createCourseMutation.mutate()}
            disabled={createCourseMutation.isPending}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{createCourseMutation.isPending ? "Publishing..." : "Create Course"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
