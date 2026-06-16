import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { SecurityAlertsPage } from "@/features/settings/pages/SecurityAlertsPage";

export const Route = createFileRoute("/_authed/settings/security-alerts")({
  staticData: {
    nav: {
      iconKey: "LayoutDashboard",
      label: "Alertas de seguridad",
      order: 98,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Alertas de seguridad",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: SecurityAlertsPage,
});
