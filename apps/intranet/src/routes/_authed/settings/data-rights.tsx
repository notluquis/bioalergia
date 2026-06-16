import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { DataRightsPage } from "@/features/data-rights/pages/DataRightsPage";

export const Route = createFileRoute("/_authed/settings/data-rights")({
  staticData: {
    nav: { iconKey: "Fingerprint", label: "Derechos del titular", order: 95, section: "Sistema" },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Derechos del titular",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: DataRightsPage,
});
