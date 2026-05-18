import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/conclusion-templates")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/exam-reports", search: { tab: "plantillas" }, replace: true });
  },
  component: () => null,
});
