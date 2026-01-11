import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/finanzas/")({
  beforeLoad: () => {
    throw redirect({ to: "/finanzas/conciliaciones" });
  },
});
