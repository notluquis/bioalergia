import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/wa-cloud/catalogo")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({ to: "/wa-cloud", search: { tab: "catalogo" }, replace: true });
  },
  component: () => null,
});
