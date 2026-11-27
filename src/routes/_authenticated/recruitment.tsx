import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Users,
  Calendar,
  BarChart3,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Candidate, JobOpening } from "@/lib/recruitment";
import { CandidatePipelineBoard } from "@/components/recruitment/CandidatePipelineBoard";
import { JobOpeningsManager } from "@/components/recruitment/JobOpeningsManager";
import { InterviewCalendarView } from "@/components/recruitment/InterviewCalendarView";
import { RecruitmentAnalyticsView } from "@/components/recruitment/RecruitmentAnalyticsView";
import { CandidateDetailDrawer } from "@/components/recruitment/CandidateDetailDrawer";
import { CandidateRegistrationModal } from "@/components/recruitment/CandidateRegistrationModal";
import { JobOpeningModal } from "@/components/recruitment/JobOpeningModal";

export const Route = createFileRoute("/_authenticated/recruitment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recruitment & Talent Acquisition — Flowpeople" },
      {
        name: "description",
        content:
          "Manage job requisitions, candidate evaluation pipelines, interview scheduling, and employee conversion.",
      },
    ],
  }),
  component: RecruitmentPage,
});

function RecruitmentPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pipeline" | "jobs" | "interviews" | "analytics">("pipeline");
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("all");

  // Drawer / Modals
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);

  // Load all candidates
  const {
    data: candidates = [],
    isLoading: loadingCandidates,
    refetch: refetchCandidates,
  } = useQuery({
    queryKey: ["all-recruitment-candidates"],
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
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load candidates:", error.message);
        return [];
      }
      return (data ?? []) as unknown as Candidate[];
    },
  });

  // Load job openings
  const {
    data: jobOpenings = [],
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["all-job-openings-recruitment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_openings")
        .select("id, title, status, openings_count, min_salary, max_salary, department_id, departments:department_id(name)")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data as unknown as JobOpening[];
    },
  });

  const handleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setDetailDrawerOpen(true);
  };

  const handleSelectJobForCandidates = (jobId: string) => {
    setSelectedJobFilter(jobId);
    setActiveTab("pipeline");
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        breadcrumbs={[{ label: "Recruitment Pipeline" }]}
        title="Recruitment & Talent Acquisition"
        description="Job requisitions, candidate pipeline management, interview scoring, and candidate-to-employee conversion."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchCandidates();
                refetchJobs();
              }}
              className="gap-1.5 h-9 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setJobModalOpen(true)}
              className="gap-1.5 h-9 text-xs"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>New Opening</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setCandidateModalOpen(true)}
              className="gap-1.5 font-semibold h-9 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Candidate</span>
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-4 max-w-xl h-10 bg-muted/60 p-1">
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm gap-2">
            <Users className="w-4 h-4" />
            <span>Pipeline ({candidates.length})</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs sm:text-sm gap-2">
            <Briefcase className="w-4 h-4" />
            <span>Jobs ({jobOpenings.length})</span>
          </TabsTrigger>
          <TabsTrigger value="interviews" className="text-xs sm:text-sm gap-2">
            <Calendar className="w-4 h-4" />
            <span>Interviews</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pipeline */}
        <TabsContent value="pipeline" className="m-0">
          <CandidatePipelineBoard
            candidates={candidates}
            onSelectCandidate={handleSelectCandidate}
            onAddCandidateClick={() => setCandidateModalOpen(true)}
            selectedJobId={selectedJobFilter}
            onJobFilterChange={setSelectedJobFilter}
            jobOpenings={jobOpenings.map((j) => ({ id: j.id, title: j.title }))}
          />
        </TabsContent>

        {/* Tab 2: Job Openings */}
        <TabsContent value="jobs" className="m-0">
          <JobOpeningsManager
            onSelectJobForCandidates={handleSelectJobForCandidates}
          />
        </TabsContent>

        {/* Tab 3: Interviews Calendar */}
        <TabsContent value="interviews" className="m-0">
          <InterviewCalendarView />
        </TabsContent>

        {/* Tab 4: Analytics */}
        <TabsContent value="analytics" className="m-0">
          <RecruitmentAnalyticsView
            candidates={candidates}
            jobOpenings={jobOpenings}
          />
        </TabsContent>
      </Tabs>

      {/* Candidate Detail Drawer */}
      <CandidateDetailDrawer
        candidateId={selectedCandidateId}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onCandidateUpdated={() => {
          refetchCandidates();
          queryClient.invalidateQueries({ queryKey: ["all-recruitment-candidates"] });
        }}
      />

      {/* Add Candidate Modal */}
      <CandidateRegistrationModal
        open={candidateModalOpen}
        onOpenChange={setCandidateModalOpen}
        defaultJobOpeningId={selectedJobFilter !== "all" ? selectedJobFilter : null}
        onSuccess={() => {
          refetchCandidates();
          queryClient.invalidateQueries({ queryKey: ["all-recruitment-candidates"] });
        }}
      />

      {/* New Job Opening Modal */}
      <JobOpeningModal
        open={jobModalOpen}
        onOpenChange={setJobModalOpen}
        onSuccess={() => {
          refetchJobs();
          queryClient.invalidateQueries({ queryKey: ["all-job-openings-recruitment"] });
        }}
      />
    </PageContainer>
  );
}
