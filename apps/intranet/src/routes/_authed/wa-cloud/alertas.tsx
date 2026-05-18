import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect-only shell — legacy URL forwarded to the unified `/wa-cloud`
// host (Phase 2 IA consolidation). Kept so bookmarks + push payloads +
// notification deep-links still resolve.
export const Route = createFileRoute("/_authed/wa-cloud/alertas")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "alertas" }, replace: true });
  },
  component: () => null,
});
