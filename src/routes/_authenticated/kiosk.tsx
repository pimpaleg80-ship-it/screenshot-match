import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kiosk")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/attendance" });
  },
  component: () => null,
});
