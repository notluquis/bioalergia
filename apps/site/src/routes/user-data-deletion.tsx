import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias → canonical legal route (preserves external/compliance URLs).
export const Route = createFileRoute("/user-data-deletion")({
  beforeLoad: () => {
    throw redirect({ to: "/data-deletion" });
  },
});
