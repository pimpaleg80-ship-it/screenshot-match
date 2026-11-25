import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Video,
  User,
  Award,
  Search,
  ExternalLink,
  Star,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  CandidateInterview,
  getInterviewStatusBadge,
  getRecommendationBadge,
} from "@/lib/recruitment";
import { formatDate } from "@/lib/attendance";
import { InterviewFeedbackModal } from "./InterviewFeedbackModal";

export function InterviewCalendarView() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterScope, setFilterScope] = useState<"all" | "my">("all");

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<CandidateInterview | null>(null);

  // Fetch all interviews
  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["all-recruitment-interviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_interviews")
        .select(`
          *,
          candidate:candidate_id (
            id,
            full_name,
            email,
            stage
          ),
          job_opening:job_opening_id (
            id,
            title
          ),
          interviewer:interviewer_id (
            id,
            full_name,
            employee_code,
            designation
          )
        `)
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.warn("Could not load interviews:", error.message);
        return [];
      }
      return (data ?? []) as unknown as CandidateInterview[];
    },
  });

  const filteredInterviews = interviews.filter((iv) => {
    if (filterScope === "my" && session.employeeId) {
      if (iv.interviewer_id !== session.employeeId) return false;
    }
    if (statusFilter !== "all" && iv.status !== statusFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCand = iv.candidate?.full_name?.toLowerCase().includes(q);
      const matchInterviewer = iv.interviewer?.full_name?.toLowerCase().includes(q);
      const matchRound = iv.round_name?.toLowerCase().includes(q);
      const matchJob = iv.job_opening?.title?.toLowerCase().includes(q);
      if (!matchCand && !matchInterviewer && !matchRound && !matchJob) return false;
    }

    return true;
  });

  const upcomingCount = interviews.filter(
    (i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() >= Date.now()
  ).length;

  const completedCount = interviews.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>UPCOMING INTERVIEWS</span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {upcomingCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Scheduled rounds pending evaluation
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>COMPLETED ROUNDS</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Interviews with submitted scorecards
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>TOTAL SCHEDULED</span>
              <Clock className="w-4 h-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {interviews.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All interview rounds in the organization
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate, interviewer, or round..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {session.employeeId && (
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
              <Button
                variant={filterScope === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setFilterScope("all")}
              >
                All Interviews
              </Button>
              <Button
                variant={filterScope === "my" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setFilterScope("my")}
              >
                Assigned to Me
              </Button>
            </div>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interviews Grid / List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : filteredInterviews.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-semibold text-foreground text-sm">
            No interviews found
          </p>
          <p>Schedule interview rounds from candidate detail profiles.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInterviews.map((iv) => {
            const statusB = getInterviewStatusBadge(iv.status);
            const recB = getRecommendationBadge(iv.recommendation);

            return (
              <Card
                key={iv.id}
                className="p-4 sm:p-5 hover:border-primary/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {iv.candidate?.full_name || "Candidate"}
                    </span>
                    {iv.job_opening?.title && (
                      <Badge variant="secondary" className="text-[10px]">
                        {iv.job_opening.title}
                      </Badge>
                    )}
                    <Badge variant="outline" className={statusB.colorClass + " text-[10px]"}>
                      {statusB.label}
                    </Badge>
                    {iv.recommendation && (
                      <Badge variant="outline" className={recB.colorClass + " text-[10px]"}>
                        {recB.label}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {iv.round_name}
                    </span>
                    <span>•</span>
                    <span>
                      Interviewer: <strong>{iv.interviewer?.full_name}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(iv.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({iv.duration_minutes || 45} mins)
                    </span>
                    <span>•</span>
                    <span>{formatDate(iv.scheduled_at)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {iv.meeting_link && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 text-primary border-primary/30"
                      onClick={() => window.open(iv.meeting_link!, "_blank")}
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join
                    </Button>
                  )}

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => {
                      setSelectedInterview(iv);
                      setFeedbackModalOpen(true);
                    }}
                  >
                    <Award className="w-3.5 h-3.5" />
                    {iv.status === "completed"
                      ? "Edit Feedback"
                      : "Submit Scorecard"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Feedback Modal */}
      <InterviewFeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        interview={selectedInterview}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-recruitment-interviews"] });
        }}
      />
    </div>
  );
}
