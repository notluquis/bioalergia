import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { TiendaSettingsPage } from "@/pages/settings/TiendaSettingsPage";

export const Route = createFileRoute("/_authed/settings/tienda")({
  staticData: {
    nav: { iconKey: "Store", label: "Tienda", order: 65, section: "Sistema" },
    permission: { action: "update", subject: "Setting" },
    title: "Configuración — Tienda",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "Setting")) {
      const routeApi = getRouteApi("/_authed/settings/tienda");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: TiendaSettingsPage,
});
