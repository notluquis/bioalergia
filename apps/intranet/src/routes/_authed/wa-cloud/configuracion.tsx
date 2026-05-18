import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud/configuracion")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "configuracion" }, replace: true });
  },
  component: () => null,
});
