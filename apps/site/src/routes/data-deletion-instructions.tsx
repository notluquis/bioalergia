import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias → canonical legal route (preserves external/compliance URLs).
export const Route = createFileRoute("/data-deletion-instructions")({
  beforeLoad: () => {
    throw redirect({ to: "/data-deletion" });
  },
});
