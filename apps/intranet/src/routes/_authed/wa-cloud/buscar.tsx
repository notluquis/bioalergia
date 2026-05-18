import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy global-search page. Now opens the right-side search drawer on
// the inbox tab via the host's `?search=1` marker. The host strips the
// marker after mount so refresh doesn't re-open the drawer.
export const Route = createFileRoute("/_authed/wa-cloud/buscar")({
  staticData: { hideFromNav: true },
  beforeLoad: () => {
    throw redirect({
      to: "/wa-cloud",
      search: { tab: "inbox", search: 1 },
      replace: true,
    });
  },
  component: () => null,
});
