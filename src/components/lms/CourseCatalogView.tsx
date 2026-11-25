import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  LmsCourse,
  LmsCourseEnrollment,
  LmsCertificate,
  getCourseLevelBadge,
  getEnrollmentStatusBadge,
  formatCourseDuration,
} from "@/lib/performance-lms";
import { LessonPlayerModal } from "./LessonPlayerModal";
import { CourseAssignmentModal } from "./CourseAssignmentModal";
import { CourseCreatorModal } from "./CourseCreatorModal";
import { CertificateViewDialog } from "./CertificateViewDialog";
import {
  BookOpen,
  Search,
  Filter,
  Clock,
  Award,
  Users,
  Play,
  CheckCircle2,
  Plus,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface CourseCatalogViewProps {
  filterMyEnrollmentsOnly?: boolean;
}

export function CourseCatalogView({
  filterMyEnrollmentsOnly = false,
}: CourseCatalogViewProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");

  // Modals state
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState<LmsCourse | null>(null);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | undefined>(undefined);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [courseToAssign, setCourseToAssign] = useState<LmsCourse | null>(null);

  const [createCourseOpen, setCreateCourseOpen] = useState(false);

  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<LmsCertificate | null>(null);

  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  // 1. Fetch all published courses
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lms-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_courses" as any)
        .select(
          `
          *,
          modules:lms_modules(count),
          enrollments:lms_course_enrollments(count)
        `
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data ?? []).map((c: any) => ({
        ...c,
        modules_count: c.modules?.[0]?.count || 0,
        enrollments_count: c.enrollments?.[0]?.count || 0,
      })) as LmsCourse[];
    },
  });

  // 2. Fetch current employee's enrollments
  const { data: myEnrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["my-lms-learning", session.employeeId],
    enabled: Boolean(session.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_course_enrollments" as any)
        .select(
          `
          *,
          course:lms_courses(*)
        `
        )
        .eq("employee_id", session.employeeId!);

      if (error) return [];
      return (data ?? []) as unknown as LmsCourseEnrollment[];
    },
  });

  // 3. Fetch certificates earned
  const { data: certificates = [] } = useQuery({
    queryKey: ["lms-certificates", session.employeeId],
    enabled: Boolean(session.employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_certificates" as any)
        .select(
          `
          *,
          course:lms_courses(title, category, estimated_duration_minutes),
          employee:employees(full_name, employee_code, designation)
        `
        )
        .eq("employee_id", session.employeeId!);

      if (error) return [];
      return (data ?? []) as unknown as LmsCertificate[];
    },
  });

  const enrollmentMap = new Map<string, LmsCourseEnrollment>();
  myEnrollments.forEach((e) => enrollmentMap.set(e.course_id, e));

  const certMap = new Map<string, LmsCertificate>();
  certificates.forEach((c) => certMap.set(c.course_id, c));

  // Self-enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      if (!session.employeeId) throw new Error("Employee profile not found");

      const { data, error } = await supabase
        .from("lms_course_enrollments" as any)
        .insert({
          course_id: courseId,
          employee_id: session.employeeId,
          status: "enrolled",
          progress_percent: 0,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, courseId: string) => {
      toast.success("Enrolled in training course successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-lms-learning"] });
      queryClient.invalidateQueries({ queryKey: ["lms-courses"] });

      // Open player immediately
      const course = courses.find((c) => c.id === courseId);
      if (course) {
        setActiveCourse(course);
        setActiveEnrollmentId(data.id);
        setPlayerOpen(true);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to enroll in course");
    },
  });

  const handleStartOrResume = (course: LmsCourse) => {
    const existingEnrollment = enrollmentMap.get(course.id);
    setActiveCourse(course);
    setActiveEnrollmentId(existingEnrollment?.id);
    setPlayerOpen(true);
  };

  const handleViewCert = (courseId: string) => {
    const cert = certMap.get(courseId);
    if (cert) {
      setSelectedCert(cert);
      setCertModalOpen(true);
    }
  };

  // Filter courses
  const filteredCourses = courses.filter((c) => {
    if (filterMyEnrollmentsOnly && !enrollmentMap.has(c.id)) {
      return false;
    }

    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "all" || c.category === selectedCategory;
    const matchesLevel = selectedLevel === "all" || c.level === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  // Extract distinct categories
  const categories = Array.from(new Set(courses.map((c) => c.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search training courses, topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-[120px] h-9 text-xs hidden sm:flex">
              <SelectValue placeholder="Skill Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isHRorAdmin && !filterMyEnrollmentsOnly && (
          <Button
            size="sm"
            onClick={() => setCreateCourseOpen(true)}
            className="h-9 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </Button>
        )}
      </div>

      {/* Courses Grid */}
      {loadingCourses || loadingEnrollments ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading training courses...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg border-border bg-card/50">
          <BookOpen className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Courses Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {filterMyEnrollmentsOnly
              ? "You are not enrolled in any training courses yet. Browse the catalog to start learning!"
              : "No courses match your active search filters."}
          </p>
          {isHRorAdmin && !filterMyEnrollmentsOnly && (
            <Button size="sm" onClick={() => setCreateCourseOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Course
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const levelBadge = getCourseLevelBadge(course.level);
            const enrollment = enrollmentMap.get(course.id);
            const statusBadge = enrollment ? getEnrollmentStatusBadge(enrollment.status) : null;
            const certificate = certMap.get(course.id);

            return (
              <Card
                key={course.id}
                className="border-border hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Card Thumbnail / Header banner */}
                  <div className="h-32 bg-muted/40 border-b border-border relative flex items-center justify-center p-4">
                    <BookOpen className="w-12 h-12 text-primary/40 group-hover:scale-110 transition-transform" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <Badge variant="outline" className="bg-card/90 text-foreground text-[11px] shadow-xs">
                        {course.category}
                      </Badge>
                      <Badge variant="outline" className={`${levelBadge.colorClass} text-[11px]`}>
                        {levelBadge.label}
                      </Badge>
                    </div>

                    {statusBadge && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="outline" className={`${statusBadge.colorClass} text-[11px]`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {course.description || "Comprehensive corporate training curriculum and assessment."}
                    </p>

                    {/* Meta: Duration, Modules, Pass score */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatCourseDuration(course.estimated_duration_minutes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {course.modules_count ?? 1} Lesson(s)
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        Pass: {course.passing_score_percent}%
                      </span>
                    </div>

                    {/* Progress Bar if enrolled */}
                    {enrollment && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-bold text-foreground">
                            {enrollment.progress_percent}%
                          </span>
                        </div>
                        <Progress
                          value={enrollment.progress_percent}
                          className="h-1.5 rounded-full"
                        />
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 pt-0 border-t border-border mt-2 flex items-center justify-between gap-2">
                  {/* Left: Certificate or Assign button */}
                  {certificate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCert(course.id)}
                      className="gap-1.5 h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Certificate</span>
                    </Button>
                  ) : isManager ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCourseToAssign(course);
                        setAssignModalOpen(true);
                      }}
                      className="gap-1 h-8 text-xs"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Assign</span>
                    </Button>
                  ) : (
                    <div />
                  )}

                  {/* Right: Learn / Enroll button */}
                  {enrollment ? (
                    <Button
                      size="sm"
                      onClick={() => handleStartOrResume(course)}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {enrollment.status === "completed" ? "Review Course" : "Continue"}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => enrollMutation.mutate(course.id)}
                      disabled={enrollMutation.isPending}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Enroll Now</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* LESSON PLAYER MODAL */}
      <LessonPlayerModal
        open={playerOpen}
        onOpenChange={setPlayerOpen}
        course={activeCourse}
        enrollmentId={activeEnrollmentId}
      />

      {/* COURSE ASSIGNMENT MODAL */}
      <CourseAssignmentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        course={courseToAssign}
      />

      {/* COURSE CREATOR MODAL */}
      <CourseCreatorModal
        open={createCourseOpen}
        onOpenChange={setCreateCourseOpen}
      />

      {/* CERTIFICATE VIEW DIALOG */}
      <CertificateViewDialog
        open={certModalOpen}
        onOpenChange={setCertModalOpen}
        certificate={selectedCert}
      />
    </div>
  );
}
