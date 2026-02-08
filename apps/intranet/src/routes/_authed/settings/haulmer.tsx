import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const HaulmerSyncPage = lazy(() =>
  import("@/pages/settings/HaulmerSyncPage").then((m) => ({ default: m.HaulmerSyncPage })),
);

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
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <HaulmerSyncPage />
    </Suspense>
  ),
});
