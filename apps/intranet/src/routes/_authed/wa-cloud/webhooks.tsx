import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud/webhooks")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "webhooks" }, replace: true });
  },
  component: () => null,
});
