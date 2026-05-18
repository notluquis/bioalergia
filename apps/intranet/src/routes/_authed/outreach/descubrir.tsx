import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy `/outreach/descubrir` URL — redirects to the unified
 * directorio host (`/outreach/directorio?tab=descubrir`).
 *
 * Hidden from nav; preserves bookmarks.
 */
export const Route = createFileRoute("/_authed/outreach/descubrir")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: "/outreach/directorio",
      search: { tab: "descubrir" },
      replace: true,
    });
  },
  component: () => null,
});
