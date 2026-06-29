import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias → canonical legal route (preserves external/compliance URLs).
export const Route = createFileRoute("/privacy-policy")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy" });
  },
});
