import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { inventoryKeys } from "@/features/inventory/queries";

const InventoryPage = lazy(() => import("@/features/operations/inventory/pages/InventoryPage"));

export const Route = createFileRoute("/_authed/operations/inventory")({
  staticData: {
    nav: { iconKey: "Box", label: "Inventario", order: 3, section: "Insumos" },
    permission: { action: "read", subject: "InventoryItem" },
    title: "Inventario",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "InventoryItem")) {
      const routeApi = getRouteApi("/_authed/operations/inventory");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
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
