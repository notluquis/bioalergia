import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SettlementsPage = lazy(() => import("@/features/finance/mercadopago/pages/SettlementTransactionsPage"));

export const Route = createFileRoute("/_authed/finanzas/conciliaciones")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/finanzas/conciliaciones");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SettlementsPage />
    </Suspense>
  ),
});
