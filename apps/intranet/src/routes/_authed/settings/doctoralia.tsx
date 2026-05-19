import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { DoctoraliaSettingsPage } from "@/pages/settings/DoctoraliaSettingsPage";

export const Route = createFileRoute("/_authed/settings/doctoralia")({
  staticData: {
    nav: { iconKey: "Mail", label: "Doctoralia (config)", order: 80, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
    title: "Configuración — Doctoralia",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/doctoralia");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: DoctoraliaSettingsPage,
});
