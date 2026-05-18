import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Legacy `/outreach/establecimientos` URL — redirects to the unified
 * directorio host (`/outreach/directorio?tab=establecimientos`).
 *
 * The child route `/outreach/establecimientos/$rbd` (detail page) is
 * intentionally preserved as a leaf detail surface — row-level deep
 * links from the directorio listing keep working. The redirect only
 * fires when this route is the leaf match (no `$rbd` segment).
 *
 * Hidden from nav.
 */
export const Route = createFileRoute("/_authed/outreach/establecimientos")({
  staticData: { hideFromNav: true },
  beforeLoad: ({ location }) => {
    // Only redirect the bare `/outreach/establecimientos` URL — let
    // `/outreach/establecimientos/$rbd` fall through to the child route.
    const normalized = location.pathname.replace(/\/+$/, "");
    if (normalized === "/outreach/establecimientos") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: "/outreach/directorio",
        search: { tab: "establecimientos" },
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
});
