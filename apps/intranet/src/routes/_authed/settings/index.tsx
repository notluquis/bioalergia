import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings/")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/settings/");
    throw routeApi.redirect({ to: "/settings/roles" });
  },
});
