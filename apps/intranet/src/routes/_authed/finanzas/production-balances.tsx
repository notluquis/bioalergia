import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

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
  beforeLoad: requirePermission("read", "DailyBalance"),
  component: DailyBalancePage,
});
