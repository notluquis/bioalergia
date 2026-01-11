import { createFileRoute, redirect } from "@tanstack/react-router";

// Index route for calendar - redirects to schedule
export const Route = createFileRoute("/_authed/calendar/")({
  beforeLoad: () => {
    throw redirect({ to: "/calendar/schedule" });
  },
});
