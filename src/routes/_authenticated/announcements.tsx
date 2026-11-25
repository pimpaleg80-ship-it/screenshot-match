import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { EngagementDashboard } from "@/components/engagement/EngagementDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/announcements")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Internal Communication & Engagement — Flowpeople" },
      {
        name: "description",
        content: "Company notices, team polls, surveys, and employee suggestions.",
      },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const session = useSession();

  if (session.loading) {
    return (
      <div className="space-y-6 py-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const userMeta = (session.user?.user_metadata || {}) as Record<string, any>;
  const orgId = userMeta["organization_id"] || "00000000-0000-0000-0000-000000000001";
  const userId = session.user?.id || "";
  const userRole = session.isAdmin || session.isSuperadmin
    ? "admin"
    : session.isManager
    ? "manager"
    : "employee";

  return (
    <EngagementDashboard
      organizationId={orgId}
      userId={userId}
      employeeId={session.employeeId}
      userRole={userRole}
      userDepartmentId={session.departmentId}
    />
  );
}
