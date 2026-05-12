import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/hr/")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/hr/");
    throw routeApi.redirect({ to: "/hr/employees" });
  },
});
