import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const DailyBalancePage = lazy(() => import("@/features/production-balances/DailyBalancePage"));

export const Route = createFileRoute("/_authed/finanzas/production-balances")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "DailyBalance")) {
      const routeApi = getRouteApi("/_authed/finanzas/production-balances");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <DailyBalancePage />
    </Suspense>
  ),
});
