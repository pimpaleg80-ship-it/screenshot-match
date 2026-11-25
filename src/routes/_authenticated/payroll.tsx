import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { PayrollDashboard } from "@/components/payroll/PayrollDashboard";
import { SelfServicePayslips } from "@/components/self-service/SelfServicePayslips";
import { Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollRoutePage,
});

function PayrollRoutePage() {
  const session = useSession();
  const isAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isAdmin;

  const userMeta = (session.user?.user_metadata || {}) as Record<string, any>;
  const orgId = userMeta["organization_id"] || "00000000-0000-0000-0000-000000000001";
  const userId = session.user?.id || "";

  if (isAdmin || isManager) {
    return (
      <PageContainer maxWidth="wide">
        <PayrollDashboard
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
        breadcrumbs={[{ label: "My Payslips" }]}
        title="My Compensation & Payslips"
        description="Inspect official monthly salary slips, gross earnings, EPF/ESI/PT deductions, and download signed compensation PDFs."
      />

      <SelfServicePayslips
        employeeId={session.employeeId || ""}
        employeeName={userMeta["full_name"] || "Employee"}
        employeeCode={userMeta["employee_code"] || "EMP"}
        departmentName={userMeta["department_name"]}
        designation={userMeta["designation"]}
      />
    </PageContainer>
  );
}