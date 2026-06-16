import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { ComplaintsPage } from "@/features/complaints/pages/ComplaintsPage";

export const Route = createFileRoute("/_authed/settings/complaints")({
  staticData: {
    nav: { iconKey: "ClipboardList", label: "Reclamos y libros", order: 97, section: "Sistema" },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Reclamos y libros foliados",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: ComplaintsPage,
});
