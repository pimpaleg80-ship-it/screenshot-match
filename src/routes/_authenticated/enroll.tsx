import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/enroll")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/attendance" });
  },
  component: () => null,
});
