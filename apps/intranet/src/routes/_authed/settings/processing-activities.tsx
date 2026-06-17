import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { ProcessingActivitiesPage } from "@/features/processing-activities/pages/ProcessingActivitiesPage";

export const Route = createFileRoute("/_authed/settings/processing-activities")({
  staticData: {
    nav: {
      iconKey: "ListChecks",
      label: "Registro de tratamientos (RAT)",
      order: 99,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Registro de tratamientos (RAT)",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: ProcessingActivitiesPage,
});
