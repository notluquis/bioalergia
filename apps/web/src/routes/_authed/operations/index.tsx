import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/operations/")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/operations/");
    throw routeApi.redirect({ to: "/operations/inventory" });
  },
});
