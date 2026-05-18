import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy `/outreach/crawler-masivo` URL — redirects to the unified
 * directorio host (`/outreach/directorio?tab=crawler`).
 *
 * Hidden from nav; preserves bookmarks.
 */
export const Route = createFileRoute("/_authed/outreach/crawler-masivo")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: "/outreach/directorio",
      search: { tab: "crawler" },
      replace: true,
    });
  },
  component: () => null,
});
