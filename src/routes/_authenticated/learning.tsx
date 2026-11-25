import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { CourseCatalogView } from "@/components/lms/CourseCatalogView";
import { BookOpen, GraduationCap, Award, Compass } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/learning")({
  component: LearningPage,
});

function LearningPage() {
  const session = useSession();

  return (
    <PageContainer maxWidth="wide">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Learning & LMS" }]}
        title="Learning & Skill Development"
        description="Explore organizational training courses, video lessons, reference manuals, interactive quizzes, and earn verified certificates of completion."
      />

      {/* Tabs */}
      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-lg flex flex-wrap h-auto gap-1">
          <TabsTrigger value="catalog" className="gap-2 text-xs sm:text-sm">
            <Compass className="w-4 h-4" />
            <span>Course Catalog</span>
          </TabsTrigger>

          <TabsTrigger value="my-courses" className="gap-2 text-xs sm:text-sm">
            <BookOpen className="w-4 h-4" />
            <span>My Learning & Progress</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="m-0 focus-visible:outline-hidden">
          <CourseCatalogView filterMyEnrollmentsOnly={false} />
        </TabsContent>

        <TabsContent value="my-courses" className="m-0 focus-visible:outline-hidden">
          <CourseCatalogView filterMyEnrollmentsOnly={true} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}