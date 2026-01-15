import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SyncHistoryPage = lazy(() => import("@/pages/admin/SyncHistoryPage"));

export const Route = createFileRoute("/_authed/settings/sync-history")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "SyncLog")) {
      const routeApi = getRouteApi("/_authed/settings/sync-history");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SyncHistoryPage />
    </Suspense>
  ),
});
