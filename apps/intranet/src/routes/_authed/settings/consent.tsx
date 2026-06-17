import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { ConsentPage } from "@/features/consent/pages/ConsentPage";

export const Route = createFileRoute("/_authed/settings/consent")({
  staticData: {
    nav: { iconKey: "UserCheck", label: "Consentimientos", order: 100, section: "Sistema" },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Consentimientos",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: ConsentPage,
});
