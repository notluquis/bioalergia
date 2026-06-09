import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { DoctoraliaSettingsPage } from "@/pages/settings/DoctoraliaSettingsPage";

export const Route = createFileRoute("/_authed/settings/doctoralia")({
  staticData: {
    nav: { iconKey: "Mail", label: "Doctoralia (config)", order: 80, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
    title: "Configuración — Doctoralia",
  },
  beforeLoad: requirePermission("read", "Integration"),
  component: DoctoraliaSettingsPage,
});
