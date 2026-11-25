import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { OffboardingDashboard } from "@/components/offboarding/OffboardingDashboard";
import { SelfServiceOffboarding } from "@/components/self-service/SelfServiceOffboarding";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/offboarding")({
  component: OffboardingRoutePage,
});

function OffboardingRoutePage() {
  const session = useSession();
  const isAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isAdmin;

  const userMeta = (session.user?.user_metadata || {}) as Record<string, any>;
  const orgId = userMeta["organization_id"] || "00000000-0000-0000-0000-000000000001";
  const userId = session.user?.id || "";

  if (isAdmin || isManager) {
    return (
      <PageContainer maxWidth="wide">
        <OffboardingDashboard
        organizationId={orgId}
        userId={userId}
        isAdmin={isAdmin}
        isManager={isManager}
        />
      </PageContainer>
    );
  }

  // Employee Self-Service View
  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        breadcrumbs={[{ label: "Offboarding & Exit" }]}
        title="My Separation & Exit Status"
        description="Review separation policies, submit voluntary resignation, track transition handovers, and download exit certificates."
      />

      <SelfServiceOffboarding
        employeeId={session.employeeId || ""}
        employeeName={userMeta["full_name"] || "Employee"}
        employeeCode={userMeta["employee_code"] || "EMP"}
        joiningDate={userMeta["joining_date"]}
        designation={userMeta["designation"]}
        departmentName={userMeta["department_name"]}
      />
    </PageContainer>
  );
}