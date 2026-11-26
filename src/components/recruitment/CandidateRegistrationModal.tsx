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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CandidateRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultJobOpeningId?: string | null;
}

export function CandidateRegistrationModal({
  open,
  onOpenChange,
  onSuccess,
  defaultJobOpeningId,
}: CandidateRegistrationModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobOpeningId, setJobOpeningId] = useState<string>(defaultJobOpeningId || "");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("30");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [source, setSource] = useState("direct");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load published job openings
  const { data: jobOpenings = [] } = useQuery({
    queryKey: ["published-job-openings-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_openings")
        .select("id, title, status, departments:department_id(name)")
        .order("title", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhone("");
      setJobOpeningId(defaultJobOpeningId || "");
      setCurrentCompany("");
      setCurrentDesignation("");
      setYearsOfExperience("");
      setCurrentSalary("");
      setExpectedSalary("");
      setNoticePeriodDays("30");
      setPortfolioUrl("");
      setLinkedinUrl("");
      setSource("direct");
      setNotes("");
    }
  }, [open, defaultJobOpeningId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Please provide candidate full name and email");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: newCandidate, error: insertError } = await supabase
        .from("candidates")
        .insert({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          job_opening_id: jobOpeningId || null,
          current_company: currentCompany.trim() || null,
          current_designation: currentDesignation.trim() || null,
          years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : 0,
          current_salary: currentSalary ? Number(currentSalary) : null,
          expected_salary: expectedSalary ? Number(expectedSalary) : null,
          notice_period_days: noticePeriodDays ? Number(noticePeriodDays) : 30,
          portfolio_url: portfolioUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          source,
          stage: "applied",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Also record activity log
      if (newCandidate) {
        const { data: userAuth } = await supabase.auth.getUser();
        await supabase.from("candidate_activities").insert({
          candidate_id: newCandidate.id,
          performed_by: userAuth?.user?.id ?? null,
          action: "stage_change",
          to_stage: "applied",
          notes: "Candidate registered into recruitment pipeline",
        });
      }

      toast.success("Candidate registered successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Candidate registration error:", err);
      toast.error(err.message || "Failed to register candidate");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Register New Candidate</span>
          </DialogTitle>
          <DialogDescription>
            Enter candidate details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-name">Full Name *</Label>
              <Input
                id="cand-name"
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cand-email">Email Address *</Label>
              <Input
                id="cand-email"
                type="email"
                placeholder="e.g. john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Phone & Job Opening */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-phone">Phone Number</Label>
              <Input
                id="cand-phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Target Job Opening</Label>
              <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
                <SelectTrigger>
                  <SelectValue placeholder="General / Direct Pool" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  <SelectItem value="none">General / Unassigned</SelectItem>
                  {jobOpenings.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} {job.departments?.name && `(${job.departments.name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Company & Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-comp">Current Company</Label>
              <Input
                id="cand-comp"
                placeholder="e.g. Acme Corp"
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cand-desig">Current Designation</Label>
              <Input
                id="cand-desig"
                placeholder="e.g. Senior Software Engineer"
                value={currentDesignation}
                onChange={(e) => setCurrentDesignation(e.target.value)}
              />
            </div>
          </div>

          {/* Experience, Expected CTC, Notice Period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-exp">Experience (Years)</Label>
              <Input
                id="cand-exp"
                type="number"
                step="0.5"
                placeholder="e.g. 4.5"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cand-ectc">Expected Annual CTC (₹)</Label>
              <Input
                id="cand-ectc"
                type="number"
                placeholder="e.g. 2200000"
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cand-np">Notice Period (Days)</Label>
              <Input
                id="cand-np"
                type="number"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
              />
            </div>
          </div>

          {/* LinkedIn & Portfolio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-li">LinkedIn Profile URL</Label>
              <Input
                id="cand-li"
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cand-port">Portfolio / GitHub / Website</Label>
              <Input
                id="cand-port"
                type="url"
                placeholder="https://github.com/..."
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Source & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Application Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct Application</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Internal Referral</SelectItem>
                  <SelectItem value="career_page">Career Website</SelectItem>
                  <SelectItem value="agency">Recruitment Agency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cand-notes">Recruiter Initial Notes</Label>
              <Input
                id="cand-notes"
                placeholder="Quick observations or referral context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registering..." : "Add Candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
