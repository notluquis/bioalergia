import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const FinanzasStatsPage = lazy(
  () => import("@/features/finance/statistics/pages/FinanzasStatsPage"),
);

export const Route = createFileRoute("/_authed/finanzas/statistics")({
  staticData: {
    nav: { iconKey: "BarChart3", label: "Estadísticas", order: 4, section: "Finanzas" },
    permission: { action: "read", subject: "TransactionStats" },
    title: "Estadísticas financieras",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "TransactionStats")) {
      const routeApi = getRouteApi("/_authed/finanzas/statistics");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <FinanzasStatsPage />
    </Suspense>
  ),
});
