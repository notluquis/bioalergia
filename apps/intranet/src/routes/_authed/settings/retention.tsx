import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { RetentionPoliciesPage } from "@/features/settings/pages/RetentionPoliciesPage";

export const Route = createFileRoute("/_authed/settings/retention")({
  staticData: {
    nav: { iconKey: "Database", label: "Retención de datos", order: 90, section: "Sistema" },
    permission: { action: "update", subject: "Setting" },
    title: "Configuración — Retención de datos",
  },
  beforeLoad: requirePermission("update", "Setting"),
  component: RetentionPoliciesPage,
});
