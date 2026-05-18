import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud/broadcasts")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "broadcasts" }, replace: true });
  },
  component: () => null,
});
