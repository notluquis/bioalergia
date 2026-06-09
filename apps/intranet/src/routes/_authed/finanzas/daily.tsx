import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { DailyIncomePage } from "@/features/finance/pages/DailyIncomePage";

export const Route = createFileRoute("/_authed/finanzas/daily")({
  component: DailyIncomePage,
  staticData: {
    nav: {
      iconKey: "Receipt",
      label: "Ingresos Diarios",
      order: 30,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "Event" },
    title: "Ingresos Diarios",
  },
  beforeLoad: requirePermission("read", "Event"),
});
