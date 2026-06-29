import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias → canonical legal route (preserves external/compliance URLs).
export const Route = createFileRoute("/terms-of-service")({
  beforeLoad: () => {
    throw redirect({ to: "/terms" });
  },
});
