import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { HaulmerSyncPage } from "@/pages/settings/HaulmerSyncPage";

export const Route = createFileRoute("/_authed/settings/haulmer")({
  staticData: {
    nav: { iconKey: "Download", label: "Haulmer", order: 7, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/haulmer");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: HaulmerSyncPage,
});
