import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { DailyBalancePage } from "@/features/production-balances/DailyBalancePage";

export const Route = createFileRoute("/_authed/finanzas/production-balances")({
  staticData: {
    nav: { iconKey: "FileSpreadsheet", label: "Balance Diario", order: 40, section: "Finanzas" },
    permission: { action: "read", subject: "DailyBalance" },
    relatedSubjects: [
      "Balance",
      "Budget",
      "BudgetItem",
      "DailyProductionBalance",
      "ProductionBalance",
      "CompensationPeriodBudget",
      "CompensationProfile",
    ],
    title: "Balance diario de producción",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "DailyBalance")) {
      const routeApi = getRouteApi("/_authed/finanzas/production-balances");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: DailyBalancePage,
});
