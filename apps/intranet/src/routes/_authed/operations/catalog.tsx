import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CatalogPage } from "@/features/catalog/pages/CatalogPage";
import { catalogKeys } from "@/features/catalog/queries";

export const Route = createFileRoute("/_authed/operations/catalog")({
  staticData: {
    nav: { iconKey: "Store", label: "Catálogo", order: 15, section: "Logística" },
    permission: { action: "read", subject: "InventoryItem" },
    title: "Catálogo",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "InventoryItem")) {
      const routeApi = getRouteApi("/_authed/operations/catalog");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: CatalogPage,
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(catalogKeys.products({ includeInactive: true })),
});
