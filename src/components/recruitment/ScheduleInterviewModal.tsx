import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Video, User, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Candidate, INTERVIEW_ROUND_TYPES } from "@/lib/recruitment";

interface ScheduleInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  candidate: Candidate | null;
}

export function ScheduleInterviewModal({
  open,
  onOpenChange,
  onSuccess,
  candidate,
}: ScheduleInterviewModalProps) {
  const [roundName, setRoundName] = useState<string>(INTERVIEW_ROUND_TYPES[1] ?? "Technical Round 1");
  const [interviewerId, setInterviewerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    // Format YYYY-MM-DDTHH:mm
    return d.toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load interviewers (employees)
  const { data: employees = [] } = useQuery({
    queryKey: ["interviewers-picker-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setRoundName(INTERVIEW_ROUND_TYPES[1] ?? "Technical Round 1");
      if (employees.length > 0 && !interviewerId) {
        setInterviewerId(employees[0]?.id ?? "");
      }
      setMeetingLink("https://meet.google.com/new");
      setLocation("Online Video Call");
    }
  }, [open, employees]);

  if (!candidate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewerId) {
      toast.error("Please select an interviewer");
      return;
    }
    if (!scheduledAt) {
      toast.error("Please choose a date and time for the interview");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: interviewData, error: interviewErr } = await supabase
        .from("candidate_interviews")
        .insert({
          candidate_id: candidate.id,
          job_opening_id: candidate.job_opening_id || null,
          interviewer_id: interviewerId,
          round_name: roundName,
          scheduled_at: new Date(scheduledAt).toISOString(),
          duration_minutes: Number(durationMinutes) || 45,
          meeting_link: meetingLink.trim() || null,
          location: location.trim() || null,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (interviewErr) throw interviewErr;

      // If candidate is in applied or screening, automatically advance to interview stage
      if (["applied", "screening", "shortlisted"].includes(candidate.stage)) {
        await supabase.rpc("advance_candidate_stage", {
          p_candidate_id: candidate.id,
          p_new_stage: "interview",
          p_notes: `Scheduled ${roundName} for ${new Date(scheduledAt).toLocaleString()}`,
        });
      } else {
        // Record activity log
        const { data: userAuth } = await supabase.auth.getUser();
        await supabase.from("candidate_activities").insert({
          candidate_id: candidate.id,
          performed_by: userAuth?.user?.id ?? null,
          action: "interview_scheduled",
          notes: `Scheduled ${roundName} for ${new Date(scheduledAt).toLocaleString()}`,
        });
      }

      toast.success("Interview scheduled successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Schedule interview error:", err);
      toast.error(err.message || "Failed to schedule interview");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>Schedule Interview Round</span>
          </DialogTitle>
          <DialogDescription>
            Coordinate meeting agenda for{" "}
            <span className="font-semibold text-foreground">
              {candidate.full_name}
            </span>
            {candidate.job_openings?.title && ` (${candidate.job_openings.title})`}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Round Type */}
          <div className="space-y-1.5">
            <Label>Interview Round Name *</Label>
            <Select value={roundName} onValueChange={setRoundName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_ROUND_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interviewer */}
          <div className="space-y-1.5">
            <Label>Assigned Interviewer *</Label>
            <Select value={interviewerId} onValueChange={setInterviewerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select interviewer..." />
              </SelectTrigger>
              <SelectContent className="max-h-52">
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                    {emp.designation && ` • ${emp.designation}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time and Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sched-time">Date & Time *</Label>
              <Input
                id="sched-time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meeting Link */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-link">Meeting Link (Google Meet / Zoom)</Label>
            <div className="relative">
              <Video className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sched-link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-loc">Location / Room</Label>
            <Input
              id="sched-loc"
              placeholder="e.g. Conference Room 3B or Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
