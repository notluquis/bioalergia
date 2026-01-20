import { createFileRoute, redirect } from "@tanstack/react-router";
import { DailyIncomePage } from "@/features/finance/pages/DailyIncomePage";

export const Route = createFileRoute("/_authed/finanzas/daily")({
  component: DailyIncomePage,
  staticData: {
    nav: {
      iconKey: "CalendarDays",
      label: "Ingresos Diarios",
      order: 2,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "Event" },
    title: "Ingresos Diarios",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Event")) {
      throw redirect({ to: "/" });
    }
  },
});
