import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Layers,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  RefreshCw,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader, MetricStrip } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmployeeOnboardingRecord,
} from "@/lib/onboarding";
import { OnboardingPipelineBoard } from "@/components/onboarding/OnboardingPipelineBoard";
import { OnboardingTemplatesManager } from "@/components/onboarding/OnboardingTemplatesManager";
import { NewEmployeeOnboardingModal } from "@/components/onboarding/NewEmployeeOnboardingModal";
import { EmployeeOnboardingDetailDrawer } from "@/components/onboarding/EmployeeOnboardingDetailDrawer";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Employee Onboarding — Flowpeople" },
      {
        name: "description",
        content:
          "Manage new hire onboarding journeys, checklist workflows, joining forms, and document verification.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pipeline" | "templates">("pipeline");
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState<EmployeeOnboardingRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // Fetch all onboardings
  const {
    data: onboardings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["all-onboardings-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_onboarding")
        .select(`
          *,
          employees:employee_id (
            id,
            full_name,
            employee_code,
            email,
            phone,
            joining_date,
            designation,
            department_id,
            departments:department_id ( name )
          ),
          onboarding_templates ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load onboardings:", error.message);
        return [];
      }
      return (data ?? []) as unknown as EmployeeOnboardingRecord[];
    },
  });

  // Calculate metrics
  const inProgressCount = onboardings.filter((o) => o.status === "in_progress").length;
  const pendingReviewCount = onboardings.filter((o) => o.status === "pending_hr_review").length;
  const completedCount = onboardings.filter((o) => o.status === "completed").length;
  const draftCount = onboardings.filter((o) => o.status === "draft").length;

  const handleSelectRecord = (record: EmployeeOnboardingRecord) => {
    setSelectedOnboarding(record);
    setDetailDrawerOpen(true);
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        breadcrumbs={[{ label: "Onboarding Checklists" }]}
        title="Employee Onboarding"
        description="Standardized onboarding checklists, personal info collection, bank details, and HR verification."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 h-9 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setInitiateModalOpen(true)}
              className="gap-1.5 h-9 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Onboarding</span>
            </Button>
          </>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>IN PROGRESS</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {inProgressCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Candidates currently completing checklists
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>PENDING HR REVIEW</span>
              <AlertCircle className="w-4 h-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {pendingReviewCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Awaiting document and profile verification
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>COMPLETED ONBOARDING</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Successfully activated employees
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-muted-foreground/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>TOTAL PIPELINE</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {onboardings.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All active & historical onboarding journeys
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 max-w-md h-10 bg-muted/60 p-1">
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm gap-2">
            <Users className="w-4 h-4" />
            <span>Onboarding Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm gap-2">
            <Layers className="w-4 h-4" />
            <span>Checklist Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="m-0">
          <OnboardingPipelineBoard
            onboardings={onboardings}
            onSelectOnboarding={handleSelectRecord}
            onInitiateClick={() => setInitiateModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="templates" className="m-0">
          <OnboardingTemplatesManager />
        </TabsContent>
      </Tabs>

      {/* Initiate Onboarding Modal */}
      <NewEmployeeOnboardingModal
        open={initiateModalOpen}
        onOpenChange={setInitiateModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-onboardings-pipeline"] });
        }}
      />

      {/* Detail & Action Drawer */}
      <EmployeeOnboardingDetailDrawer
        onboarding={selectedOnboarding}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-onboardings-pipeline"] });
        }}
      />
    </PageContainer>
  );
}
