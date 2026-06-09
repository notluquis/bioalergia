import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { HaulmerSyncPage } from "@/pages/settings/HaulmerSyncPage";

export const Route = createFileRoute("/_authed/settings/haulmer")({
  staticData: {
    nav: { iconKey: "ArrowDownToLine", label: "Haulmer (auth)", order: 70, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
    relatedSubjects: ["HaulmerAuthToken", "HaulmerSyncLog"],
    title: "Configuración — Haulmer",
  },
  beforeLoad: requirePermission("read", "Integration"),
  component: HaulmerSyncPage,
});
