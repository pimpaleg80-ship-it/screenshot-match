import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/homepage/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flowpeople by Fluxora — Biometric Attendance & Workforce HRMS" },
      {
        name: "description",
        content:
          "Enterprise facial biometric attendance, exact GPS geofencing, shift and leave management, and automated Google Drive cloud archiving.",
      },
    ],
  }),
  component: HomePage,
});
