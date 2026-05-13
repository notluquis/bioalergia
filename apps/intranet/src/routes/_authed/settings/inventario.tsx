import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { InventorySettingsPage } from "@/pages/settings/InventorySettingsPage";

export const Route = createFileRoute("/_authed/settings/inventario")({
  staticData: {
    nav: { iconKey: "PackageSearch", label: "Inventario Config", order: 50, section: "Sistema" },
    permission: { action: "update", subject: "InventorySetting" },
    relatedSubjects: [
      "InventoryCategory",
      "InventoryMovement",
      "CommonSupply",
      "FinancialAutoCategoryRule",
    ],
    title: "Configuración — Inventario",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "InventorySetting")) {
      const routeApi = getRouteApi("/_authed/settings/inventario");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: InventorySettingsPage,
});
