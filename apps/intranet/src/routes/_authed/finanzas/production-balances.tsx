import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const DailyBalancePage = lazy(() =>
  import("@/features/production-balances/DailyBalancePage").then((m) => ({
    default: m.DailyBalancePage,
  })),
);

export const Route = createFileRoute("/_authed/finanzas/production-balances")({
  staticData: {
    nav: { iconKey: "FileSpreadsheet", label: "Balance Diario", order: 7, section: "Finanzas" },
    permission: { action: "read", subject: "DailyBalance" },
    title: "Balance diario de producción",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "DailyBalance")) {
      const routeApi = getRouteApi("/_authed/finanzas/production-balances");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <DailyBalancePage />
    </Suspense>
  ),
});
