import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/finanzas/")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/finanzas/");
    throw routeApi.redirect({ to: "/finanzas/conciliaciones" });
  },
});
