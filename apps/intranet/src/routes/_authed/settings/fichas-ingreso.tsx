import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { IntakeSubmissionsPage } from "@/features/intake/pages/IntakeSubmissionsPage";

export const Route = createFileRoute("/_authed/settings/fichas-ingreso")({
  staticData: {
    nav: {
      iconKey: "ClipboardList",
      label: "Fichas de ingreso",
      order: 11,
      section: "Comunicaciones",
    },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "Fichas de ingreso",
  },
  beforeLoad: requirePermission("read", "WaBusinessAccount"),
  component: IntakeSubmissionsPage,
});
