import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy `/calendar/sync-history` URL — redirects to the unified host
 * (`/calendar?tab=historial`). Hidden from nav; preserves bookmarks.
 */
export const Route = createFileRoute("/_authed/calendar/sync-history")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { tab: "historial" }, replace: true });
  },
  component: () => null,
});
