import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const InventorySettingsPage = lazy(() =>
  import("@/pages/settings/InventorySettingsPage").then((m) => ({
    default: m.InventorySettingsPage,
  })),
);

export const Route = createFileRoute("/_authed/settings/inventario")({
  staticData: {
    nav: { iconKey: "PackagePlus", label: "Conf. Inventario", order: 5, section: "Sistema" },
    permission: { action: "update", subject: "InventorySetting" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "InventorySetting")) {
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
