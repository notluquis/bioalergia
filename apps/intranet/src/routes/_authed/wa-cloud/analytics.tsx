import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud/analytics")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "analytics" }, replace: true });
  },
  component: () => null,
});
