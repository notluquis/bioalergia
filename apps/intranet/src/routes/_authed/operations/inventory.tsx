import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { inventoryKeys } from "@/features/inventory/queries";
import { InventoryPage } from "@/features/operations/inventory/pages/InventoryPage";

export const Route = createFileRoute("/_authed/operations/inventory")({
  staticData: {
    nav: { iconKey: "Package", label: "Inventario", order: 20, section: "Logística" },
    permission: { action: "read", subject: "InventoryItem" },
    title: "Inventario",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "InventoryItem")) {
      const routeApi = getRouteApi("/_authed/operations/inventory");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: InventoryPage,

  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(inventoryKeys.items());
  },
});
