import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { BreachIncidentsPage } from "@/features/breach-incidents/pages/BreachIncidentsPage";

export const Route = createFileRoute("/_authed/settings/breach-incidents")({
  staticData: {
    nav: { iconKey: "ShieldCheck", label: "Incidentes de brecha", order: 96, section: "Sistema" },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Incidentes de brecha",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: BreachIncidentsPage,
});
