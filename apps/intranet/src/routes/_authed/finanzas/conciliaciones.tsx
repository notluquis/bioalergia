import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SettlementsPage = lazy(
  () => import("@/features/finance/mercadopago/pages/SettlementTransactionsPage"),
);

export const Route = createFileRoute("/_authed/finanzas/conciliaciones")({
  staticData: {
    nav: { iconKey: "ListChecks", label: "Conciliaciones", order: 2, section: "Finanzas" },
    permission: { action: "read", subject: "Integration" },
    title: "Conciliaciones",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/finanzas/conciliaciones");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SettlementsPage />
    </Suspense>
  ),
});
