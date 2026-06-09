import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { ImmunotherapySettingsPage } from "@/features/immunotherapy/pages/ImmunotherapySettingsPage";

export const Route = createFileRoute("/_authed/settings/immunotherapy")({
  staticData: {
    nav: { iconKey: "Syringe", label: "Inmunoterapia (precios)", order: 85, section: "Sistema" },
    permission: { action: "update", subject: "Setting" },
    title: "Configuración — Inmunoterapia",
  },
  beforeLoad: requirePermission("update", "Setting"),
  component: ImmunotherapySettingsPage,
});
