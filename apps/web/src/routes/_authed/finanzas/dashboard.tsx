import { createFileRoute } from "@tanstack/react-router";
import { FinancialDashboardPage } from "@/features/finance/pages/FinancialDashboardPage";

export const Route = createFileRoute("/_authed/finanzas/dashboard")({
  component: FinancialDashboardPage,
  staticData: {
    nav: {
      iconKey: "LayoutDashboard",
      label: "Tablero Financiero",
      order: 1,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "Event" },
    title: "Tablero Financiero",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Event")) {
      const routeApi = getRouteApi("/_authed/finanzas/dashboard");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
});
