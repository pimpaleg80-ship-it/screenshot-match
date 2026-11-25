import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PerformancePeerFeedback } from "@/lib/performance-lms";
import { Star, MessageSquare, Plus, CheckCircle2, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PeerFeedbackModalProps {
  filterEmployeeId?: string | undefined;
  readOnly?: boolean | undefined;
}

export function PeerFeedbackModal({
  filterEmployeeId,
  readOnly = false,
}: PeerFeedbackModalProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<PerformancePeerFeedback | null>(null);

  // Form states for Request
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [relationship, setRelationship] = useState("peer");

  // Form states for Submission
  const [rating, setRating] = useState<number>(4);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Fetch employees for feedback request
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-peer-feedback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, department_id, departments(name)")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
  });

  // Fetch 360 Feedbacks
  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["peer-feedbacks", filterEmployeeId || session.employeeId],
    queryFn: async () => {
      let query = supabase
        .from("performance_peer_feedbacks" as any)
        .select(
          `
          *,
          employee:employees!performance_peer_feedbacks_employee_id_fkey(id, full_name, employee_code, designation),
          peer:employees!performance_peer_feedbacks_peer_id_fkey(id, full_name, employee_code, designation)
        `
        )
        .order("created_at", { ascending: false });

      const empId = filterEmployeeId || session.employeeId;
      if (empId) {
        query = query.or(`employee_id.eq.${empId},peer_id.eq.${empId}`);
      }

      const { data, error } = await query;
      if (error) return [];
      return (data ?? []) as unknown as PerformancePeerFeedback[];
    },
  });

  // Request Feedback Mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      const empId = filterEmployeeId || targetEmployeeId || session.employeeId;
      if (!empId) throw new Error("Target employee is required");
      if (!peerId) throw new Error("Please select a colleague to give feedback");
      if (empId === peerId) throw new Error("Cannot request peer feedback from yourself");

      const { error } = await supabase.from("performance_peer_feedbacks" as any).insert({
        employee_id: empId,
        peer_id: peerId,
        relationship,
        status: "requested",
        is_anonymous: false,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("360 Peer feedback request sent");
      queryClient.invalidateQueries({ queryKey: ["peer-feedbacks"] });
      setRequestDialogOpen(false);
      setPeerId("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to request peer feedback");
    },
  });

  // Submit Feedback Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeedback) return;
      if (!strengths.trim()) throw new Error("Please provide observed strengths");

      const { error } = await supabase
        .from("performance_peer_feedbacks" as any)
        .update({
          rating,
          strengths: strengths.trim(),
          areas_for_improvement: improvements.trim() || null,
          comments: comments.trim() || null,
          is_anonymous: isAnonymous,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedFeedback.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Peer feedback submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["peer-feedbacks"] });
      setSubmitDialogOpen(false);
      setSelectedFeedback(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit feedback");
    },
  });

  const openSubmitDialog = (fb: PerformancePeerFeedback) => {
    setSelectedFeedback(fb);
    setRating(fb.rating || 4);
    setStrengths(fb.strengths || "");
    setImprovements(fb.areas_for_improvement || "");
    setComments(fb.comments || "");
    setIsAnonymous(fb.is_anonymous || false);
    setSubmitDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-lg border border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span>360° Peer Feedback</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collect candid perspectives and collaborative feedback from cross-functional teammates.
          </p>
        </div>

        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setRequestDialogOpen(true)}
            className="gap-1.5 h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Request Peer Feedback</span>
          </Button>
        )}
      </div>

      {/* Feedbacks Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading 360 feedback records...</p>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="py-14 text-center border border-dashed rounded-lg border-border bg-card/40">
          <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No Peer Feedback Requests</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
            Invite colleagues, project team members, or direct reports to provide collaborative 360 reviews.
          </p>
          {!readOnly && (
            <Button size="sm" onClick={() => setRequestDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Request First Review
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedbacks.map((fb) => {
            const isTarget = session.employeeId === fb.employee_id;
            const isReviewer = session.employeeId === fb.peer_id;
            const isPending = fb.status === "requested";

            return (
              <Card
                key={fb.id}
                className="border-border hover:shadow-sm transition-shadow flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isPending
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px]"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                          }
                        >
                          {isPending ? "Pending Submission" : "Completed"}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {fb.relationship} Review
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground mt-1.5">
                        Feedback for {fb.employee?.full_name || "Employee"}
                      </h4>
                    </div>

                    {fb.rating && (
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{fb.rating}.0</span>
                      </div>
                    )}
                  </div>

                  {/* Feedback Details */}
                  {fb.status === "submitted" ? (
                    <div className="space-y-2 text-xs bg-muted/40 p-3 rounded-lg border border-border">
                      {fb.strengths && (
                        <div>
                          <strong className="text-foreground">Strengths:</strong>{" "}
                          <span className="text-muted-foreground">{fb.strengths}</span>
                        </div>
                      )}
                      {fb.areas_for_improvement && (
                        <div>
                          <strong className="text-foreground">Growth Areas:</strong>{" "}
                          <span className="text-muted-foreground">{fb.areas_for_improvement}</span>
                        </div>
                      )}
                      {fb.comments && (
                        <div>
                          <strong className="text-foreground">Notes:</strong>{" "}
                          <span className="text-muted-foreground">{fb.comments}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Waiting for {fb.peer?.full_name || "colleague"} to complete this 360 review.
                    </p>
                  )}

                  {/* Footer Meta */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {fb.is_anonymous ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Anonymous Reviewer</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3.5 h-3.5" />
                          <span>By: {fb.peer?.full_name || "Peer"}</span>
                        </>
                      )}
                    </span>

                    {/* Action button if current user is the reviewer and it's pending */}
                    {isReviewer && isPending && !readOnly && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => openSubmitDialog(fb)}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Give Feedback</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* REQUEST FEEDBACK DIALOG */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span>Request 360° Peer Feedback</span>
            </DialogTitle>
            <DialogDescription>
              Select a colleague or cross-functional team member to evaluate performance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!filterEmployeeId && (
              <div className="space-y-1.5">
                <Label>Employee Receiving Feedback</Label>
                <Select
                  value={targetEmployeeId || session.employeeId || ""}
                  onValueChange={setTargetEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Select Reviewer Colleague</Label>
              <Select value={peerId} onValueChange={setPeerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Colleague" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {employees
                    .filter(
                      (e: any) =>
                        e.id !== (filterEmployeeId || targetEmployeeId || session.employeeId)
                    )
                    .map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Working Relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peer">Peer / Teammate</SelectItem>
                  <SelectItem value="cross_functional">Cross-Functional Partner</SelectItem>
                  <SelectItem value="direct_report">Direct Report</SelectItem>
                  <SelectItem value="project_lead">Project Lead / Stakeholder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestDialogOpen(false)}
              disabled={requestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUBMIT FEEDBACK DIALOG */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Provide Peer Feedback</span>
            </DialogTitle>
            <DialogDescription>
              For {selectedFeedback?.employee?.full_name}. Provide constructive, supportive, and
              actionable feedback.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Overall Rating (1 - 5)</Label>
                <span className="text-sm font-bold text-primary">{rating} / 5</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-1 rounded ${
                      rating >= star ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"
                    }`}
                  >
                    <Star className="w-6 h-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="peer-strengths">
                Key Strengths & Collaboration Highlights <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="peer-strengths"
                placeholder="What does this person do extraordinarily well? What made working with them great?"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="peer-growth">Constructive Areas for Growth</Label>
              <Textarea
                id="peer-growth"
                placeholder="Suggestions for future collaboration, communication, or technical focus..."
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="peer-comments">Additional Comments</Label>
              <Textarea
                id="peer-comments"
                placeholder="Any other notes..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="anonymous-check"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(Boolean(checked))}
              />
              <label
                htmlFor="anonymous-check"
                className="text-xs font-medium text-foreground leading-none cursor-pointer"
              >
                Submit as Anonymous Feedback (name hidden from recipient)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
