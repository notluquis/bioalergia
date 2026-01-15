import { createFileRoute, getRouteApi } from "@tanstack/react-router";

// Index route for calendar - redirects to schedule
export const Route = createFileRoute("/_authed/calendar/")({
  beforeLoad: () => {
    const routeApi = getRouteApi("/_authed/calendar/");
    throw routeApi.redirect({ to: "/calendar/schedule" });
  },
});
