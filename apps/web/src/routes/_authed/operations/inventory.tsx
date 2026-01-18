import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { inventoryKeys } from "@/features/inventory/queries";

const InventoryPage = lazy(() => import("@/features/operations/inventory/pages/InventoryPage"));

export const Route = createFileRoute("/_authed/operations/inventory")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "InventoryItem")) {
      const routeApi = getRouteApi("/_authed/operations/inventory");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <InventoryPage />
    </Suspense>
  ),
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(inventoryKeys.items());
  },
});
