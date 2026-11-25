import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HelpdeskDashboard } from "@/components/helpdesk/HelpdeskDashboard";

export const Route = createFileRoute("/_authenticated/helpdesk")({
  component: HelpdeskRoutePage,
});

function HelpdeskRoutePage() {
  return <HelpdeskDashboard />;
}
