import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/clinic")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/exam-reports", search: { tab: "clinica" }, replace: true });
  },
  component: () => null,
});
