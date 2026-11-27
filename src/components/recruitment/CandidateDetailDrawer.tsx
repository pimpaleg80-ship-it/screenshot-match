import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Star,
  ExternalLink,
  Award,
  Video,
  UserCheck,
  XCircle,
  AlertTriangle,
  History,
  ChevronRight,
  ShieldCheck,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Candidate,
  CandidateInterview,
  CandidateActivity,
  getCandidateStageBadge,
  getOfferStatusBadge,
  getInterviewStatusBadge,
  getRecommendationBadge,
  formatSalary,
  RECRUITMENT_STAGES,
  REJECTION_REASONS,
} from "@/lib/recruitment";
import { formatDate } from "@/lib/attendance";
import { ScheduleInterviewModal } from "./ScheduleInterviewModal";
import { InterviewFeedbackModal } from "./InterviewFeedbackModal";
import { ConvertCandidateModal } from "./ConvertCandidateModal";

interface CandidateDetailDrawerProps {
  candidateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateUpdated: () => void;
}

export function CandidateDetailDrawer({
  candidateId,
  open,
  onOpenChange,
  onCandidateUpdated,
}: CandidateDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "interviews" | "offer" | "history">("profile");

  // Sub-modals
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] = useState<CandidateInterview | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]?.key ?? "skills_mismatch");
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Tab state

  // Offer details form
  const [offerSalary, setOfferSalary] = useState("");
  const [offerStatus, setOfferStatus] = useState("offered");
  const [joiningDate, setJoiningDate] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);

  // Fetch candidate details
  const { data: candidate, isLoading: loadingCandidate, refetch: refetchCandidate } = useQuery({
    queryKey: ["candidate-detail", candidateId],
    enabled: open && Boolean(candidateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          *,
          job_openings:job_opening_id (
            id,
            title,
            department_id,
            departments:department_id ( name )
          )
        `)
        .eq("id", candidateId!)
        .single();

      if (error) throw error;
      return data as unknown as Candidate;
    },
  });

  // Fetch candidate interviews
  const { data: interviews = [], refetch: refetchInterviews } = useQuery({
    queryKey: ["candidate-interviews", candidateId],
    enabled: open && Boolean(candidateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_interviews")
        .select(`
          *,
          interviewer:interviewer_id (
            id,
            full_name,
            employee_code,
            designation
          )
        `)
        .eq("candidate_id", candidateId!)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as CandidateInterview[];
    },
  });

  // Fetch candidate activity audit trail
  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ["candidate-activities", candidateId],
    enabled: open && Boolean(candidateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_activities")
        .select("*")
        .eq("candidate_id", candidateId!)
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data ?? []) as CandidateActivity[];
    },
  });

  // Tab / stage helper

  // Sync offer form
  useEffect(() => {
    if (candidate) {
      setOfferSalary(candidate.offer_salary ? String(candidate.offer_salary) : "");
      setOfferStatus(candidate.offer_status || "offered");
      setJoiningDate(candidate.joining_date || "");
    }
  }, [candidate]);

  if (!candidate && loadingCandidate) {
    return null;
  }
  if (!candidate) return null;

  const stageBadge = getCandidateStageBadge(candidate.stage);

  // Quick stage transition
  const handleStageChange = async (newStage: string) => {
    if (newStage === "rejected") {
      setRejectModalOpen(true);
      return;
    }

    try {
      const { error } = await supabase.rpc("advance_candidate_stage", {
        p_candidate_id: candidate.id,
        p_new_stage: newStage,
      });

      if (error) throw error;

      toast.success(`Candidate advanced to ${newStage}`);
      refetchCandidate();
      refetchActivities();
      onCandidateUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  // Submit rejection
  const handleConfirmRejection = async () => {
    setIsRejecting(true);
    try {
      const { error } = await supabase.rpc("advance_candidate_stage", {
        p_candidate_id: candidate.id,
        p_new_stage: "rejected",
        p_notes: rejectionNotes.trim() || null,
        p_rejection_reason: rejectionReason,
      });

      if (error) throw error;

      toast.success("Candidate marked as rejected");
      setRejectModalOpen(false);
      refetchCandidate();
      refetchActivities();
      onCandidateUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to record rejection");
    } finally {
      setIsRejecting(false);
    }
  };

  // Save offer details
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOffer(true);
    try {
      const { error } = await supabase
        .from("candidates")
        .update({
          offer_salary: offerSalary ? Number(offerSalary) : null,
          offer_status: offerStatus,
          joining_date: joiningDate || null,
          stage: offerStatus === "accepted" ? "offer" : candidate.stage,
        })
        .eq("id", candidate.id);

      if (error) throw error;

      // Log activity
      const { data: userAuth } = await supabase.auth.getUser();
      await supabase.from("candidate_activities").insert({
        candidate_id: candidate.id,
        performed_by: userAuth?.user?.id ?? null,
        action: "offer_extended",
        notes: `Offer set to ${offerStatus} with salary ${formatSalary(Number(offerSalary))}`,
      });

      toast.success("Offer details saved successfully");
      refetchCandidate();
      refetchActivities();
      onCandidateUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save offer");
    } finally {
      setSavingOffer(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col h-full bg-background border-l shadow-2xl">
        {/* Drawer Header */}
        <SheetHeader className="p-5 border-b bg-card/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                {candidate.full_name.charAt(0)}
              </div>
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{candidate.full_name}</span>
                  <Badge variant="outline" className={stageBadge.colorClass}>
                    {stageBadge.label}
                  </Badge>
                  {candidate.rating ? (
                    <div className="flex items-center gap-0.5 text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{candidate.rating}/5</span>
                    </div>
                  ) : null}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  {candidate.current_designation && (
                    <span>{candidate.current_designation}</span>
                  )}
                  {candidate.current_company && (
                    <>
                      <span>•</span>
                      <span>{candidate.current_company}</span>
                    </>
                  )}
                  {candidate.job_openings?.title && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        {candidate.job_openings.title}
                      </span>
                    </>
                  )}
                </SheetDescription>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => setScheduleModalOpen(true)}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Interview</span>
              </Button>

              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => setConvertModalOpen(true)}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Convert to Employee</span>
              </Button>
            </div>
          </div>

          {/* Quick Stage Stepper / Transition Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
              Move Stage:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {RECRUITMENT_STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleStageChange(s.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                    candidate.stage === s.key
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </SheetHeader>

        {/* Tab navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-5 pt-3 border-b bg-muted/20">
            <TabsList className="grid grid-cols-4 max-w-xl h-9 text-xs">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="interviews">
                Interviews ({interviews.length})
              </TabsTrigger>
              <TabsTrigger value="offer">Offer & Terms</TabsTrigger>
              <TabsTrigger value="history">Timeline</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: PROFILE */}
            <TabsContent value="profile" className="m-0 space-y-6">
              {/* Key Candidate Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card p-3 rounded-lg border space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Experience
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {candidate.years_of_experience || 0} Years
                  </p>
                </div>

                <div className="bg-card p-3 rounded-lg border space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Notice Period
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {candidate.notice_period_days || 0} Days
                  </p>
                </div>

                <div className="bg-card p-3 rounded-lg border space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Current CTC
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {candidate.current_salary
                      ? formatSalary(candidate.current_salary)
                      : "—"}
                  </p>
                </div>

                <div className="bg-card p-3 rounded-lg border space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Expected CTC
                  </span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {candidate.expected_salary
                      ? formatSalary(candidate.expected_salary)
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Contact & Social Links */}
              <div className="bg-card rounded-lg border p-4 space-y-3">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Contact Information & Portfolios
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`mailto:${candidate.email}`}
                      className="text-primary hover:underline font-mono"
                    >
                      {candidate.email}
                    </a>
                  </div>
                  {candidate.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{candidate.phone}</span>
                    </div>
                  )}
                  {candidate.linkedin_url && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-primary" />
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {candidate.portfolio_url && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-primary" />
                      <a
                        href={candidate.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        Portfolio / GitHub
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Notice if rejected */}
              {candidate.stage === "rejected" && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 space-y-1 text-xs text-rose-700 dark:text-rose-400">
                  <p className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    Candidate Rejected
                  </p>
                  {candidate.rejection_reason && (
                    <p>
                      <strong>Reason: </strong>
                      {REJECTION_REASONS.find(
                        (r) => r.key === candidate.rejection_reason
                      )?.label || candidate.rejection_reason}
                    </p>
                  )}
                  {candidate.rejection_notes && (
                    <p className="mt-1 text-muted-foreground italic">
                      "{candidate.rejection_notes}"
                    </p>
                  )}
                </div>
              )}

              {/* Candidate Notes */}
            </TabsContent>

            {/* TAB 2: INTERVIEWS & SCORECARDS */}
            <TabsContent value="interviews" className="m-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    Evaluation Rounds & Feedback
                  </h4>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule Round
                </Button>
              </div>

              {interviews.length === 0 ? (
                <div className="p-12 text-center bg-card rounded-lg border space-y-3">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold">No interviews scheduled yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Click Schedule Round to assign an interviewer, time slot, and meeting link.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interviews.map((iv, idx) => {
                    const statusB = getInterviewStatusBadge(iv.status);
                    const recB = getRecommendationBadge(iv.recommendation);

                    return (
                      <div
                        key={iv.id}
                        className="bg-card rounded-lg border p-4 sm:p-5 space-y-3 shadow-sm hover:border-primary/40 transition"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                Round {idx + 1}: {iv.round_name}
                              </span>
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
                              <span>
                                Interviewer:{" "}
                                <strong className="text-foreground">
                                  {iv.interviewer?.full_name}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>{formatDate(iv.scheduled_at)}</span>
                              <span>•</span>
                              <span>{iv.duration_minutes || 45} mins</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {iv.meeting_link && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 text-primary border-primary/30"
                                onClick={() => window.open(iv.meeting_link!, "_blank")}
                              >
                                <Video className="w-3.5 h-3.5" />
                                Join Call
                              </Button>
                            )}

                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => {
                                setSelectedInterviewForFeedback(iv);
                                setFeedbackModalOpen(true);
                              }}
                            >
                              <Award className="w-3.5 h-3.5" />
                              {iv.status === "completed"
                                ? "Update Scorecard"
                                : "Submit Feedback"}
                            </Button>
                          </div>
                        </div>

                        {/* If feedback submitted, show scorecard summary */}
                        {iv.status === "completed" && (
                          <div className="pt-3 border-t space-y-2 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground font-semibold">
                                Score:
                              </span>
                              <div className="flex items-center gap-1 text-amber-500 font-bold">
                                <Star className="w-4 h-4 fill-amber-400" />
                                <span>{iv.rating || 0}/5</span>
                              </div>
                            </div>

                            {iv.strengths && (
                              <p className="text-emerald-700 dark:text-emerald-300">
                                <strong>Strengths: </strong>
                                {iv.strengths}
                              </p>
                            )}

                            {iv.weaknesses && (
                              <p className="text-amber-700 dark:text-amber-300">
                                <strong>Areas of Concern: </strong>
                                {iv.weaknesses}
                              </p>
                            )}

                            {iv.feedback && (
                              <p className="text-muted-foreground italic bg-muted/40 p-2.5 rounded-lg border">
                                "{iv.feedback}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: OFFER & INDUCTION */}
            <TabsContent value="offer" className="m-0 space-y-6">
              <form onSubmit={handleSaveOffer} className="bg-card rounded-lg border p-5 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">
                      Compensation & Offer Package
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Define proposed CTC, offer status, and projected start date.
                    </p>
                  </div>
                  <Badge variant="outline" className={getOfferStatusBadge(candidate.offer_status).colorClass}>
                    {getOfferStatusBadge(candidate.offer_status).label}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="off-sal">Offered Annual CTC (₹)</Label>
                    <Input
                      id="off-sal"
                      type="number"
                      placeholder="Enter annual CTC"
                      value={offerSalary}
                      onChange={(e) => setOfferSalary(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Offer Status</Label>
                    <Select value={offerStatus} onValueChange={setOfferStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_offered">Not Offered</SelectItem>
                        <SelectItem value="offered">Offer Extended</SelectItem>
                        <SelectItem value="accepted">Offer Accepted</SelectItem>
                        <SelectItem value="declined">Offer Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="off-date">Projected Joining Date</Label>
                    <Input
                      id="off-date"
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="submit" disabled={savingOffer}>
                    {savingOffer ? "Saving..." : "Save Offer Terms"}
                  </Button>
                </div>
              </form>

              {/* Conversion callout */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm">
                    Ready to Induct into FlowPeople?
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Convert candidate into an official employee record.
                </p>
                <Button
                  onClick={() => setConvertModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Convert to Official Employee
                </Button>
              </div>
            </TabsContent>

            {/* TAB 4: HIRING TIMELINE & AUDIT LOG */}
            <TabsContent value="history" className="m-0 space-y-4">
              <h4 className="font-semibold text-sm text-foreground">
                Recruitment Audit Trail
              </h4>
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4">
                    No stage transitions recorded yet.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">
                          {act.notes || act.action}
                        </p>
                        {act.from_stage && act.to_stage && (
                          <p className="text-[11px] text-muted-foreground">
                            {act.from_stage} → {act.to_stage}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatDate(act.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Rejection Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <span>Mark Candidate as Rejected</span>
              </DialogTitle>
              <DialogDescription>
                Record the rationale for declining this applicant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Rejection Primary Reason *</Label>
                <Select value={rejectionReason} onValueChange={setRejectionReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECTION_REASONS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rej-notes">Detailed Feedback / Notes</Label>
                <Textarea
                  id="rej-notes"
                  rows={3}
                  placeholder="Optional internal notes on why candidate was not selected..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setRejectModalOpen(false)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmRejection}
                disabled={isRejecting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isRejecting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Interview Sub-modal */}
        <ScheduleInterviewModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          candidate={candidate}
          onSuccess={() => {
            refetchInterviews();
            refetchActivities();
            refetchCandidate();
            onCandidateUpdated();
          }}
        />

        {/* Submit Interview Feedback Sub-modal */}
        <InterviewFeedbackModal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          interview={selectedInterviewForFeedback}
          onSuccess={() => {
            refetchInterviews();
            refetchActivities();
            refetchCandidate();
            onCandidateUpdated();
          }}
        />

        {/* Convert Candidate Sub-modal */}
        <ConvertCandidateModal
          open={convertModalOpen}
          onOpenChange={setConvertModalOpen}
          candidate={candidate}
          onSuccess={() => {
            refetchCandidate();
            refetchActivities();
            onCandidateUpdated();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
