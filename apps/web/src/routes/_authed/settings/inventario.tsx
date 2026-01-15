import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const InventorySettingsPage = lazy(() => import("@/pages/settings/InventorySettingsPage"));

export const Route = createFileRoute("/_authed/settings/inventario")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "InventorySetting")) {
      const routeApi = getRouteApi("/_authed/settings/inventario");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <InventorySettingsPage />
    </Suspense>
  ),
});
