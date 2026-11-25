import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { PerformanceGoalsManager } from "@/components/performance/PerformanceGoalsManager";
import { PerformanceAppraisalsManager } from "@/components/performance/PerformanceAppraisalsManager";
import { PeerFeedbackModal } from "@/components/performance/PeerFeedbackModal";
import { ReviewCyclesModal } from "@/components/performance/ReviewCyclesModal";
import { Target, Award, MessageSquare, Calendar, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const session = useSession();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  return (
    <PageContainer maxWidth="wide">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Performance & Reviews" }]}
        title="Performance Management"
        description="Track employee goals, individual KPIs, review cycles, self-evaluations, manager appraisals, and 360° peer feedback."
      />

      {/* Tabs */}
      <Tabs defaultValue="goals" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-lg flex flex-wrap h-auto gap-1">
          <TabsTrigger value="goals" className="gap-2 text-xs sm:text-sm">
            <Target className="w-4 h-4" />
            <span>Goals & KPIs</span>
          </TabsTrigger>

          <TabsTrigger value="appraisals" className="gap-2 text-xs sm:text-sm">
            <Award className="w-4 h-4" />
            <span>Appraisals & Reviews</span>
          </TabsTrigger>

          <TabsTrigger value="peer-feedback" className="gap-2 text-xs sm:text-sm">
            <MessageSquare className="w-4 h-4" />
            <span>360° Peer Feedback</span>
          </TabsTrigger>

          {isManager && (
            <TabsTrigger value="cycles" className="gap-2 text-xs sm:text-sm">
              <Calendar className="w-4 h-4" />
              <span>Review Cycles</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="goals" className="m-0 focus-visible:outline-hidden">
          <PerformanceGoalsManager />
        </TabsContent>

        <TabsContent value="appraisals" className="m-0 focus-visible:outline-hidden">
          <PerformanceAppraisalsManager />
        </TabsContent>

        <TabsContent value="peer-feedback" className="m-0 focus-visible:outline-hidden">
          <PeerFeedbackModal />
        </TabsContent>

        {isManager && (
          <TabsContent value="cycles" className="m-0 focus-visible:outline-hidden">
            <ReviewCyclesModal />
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  );
}