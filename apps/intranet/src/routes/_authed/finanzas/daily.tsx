import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/finanzas/daily")({
  beforeLoad: () => {
    throw redirect({ to: "/finanzas/dashboard", search: { tab: "ingresos" } });
  },
});
