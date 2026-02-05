import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const SettlementReleasePage = lazy(() =>
  import("@/features/finance/mercadopago/pages/SettlementReleaseTransactionsPage").then((m) => ({
    default: m.SettlementReleaseTransactionsPage,
  })),
);

export const Route = createFileRoute("/_authed/finanzas/conciliaciones-liberaciones")({
  staticData: {
    nav: {
      iconKey: "Database",
      label: "Conciliaciones + Liberaciones",
      order: 4,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "Integration" },
    title: "Conciliaciones + Liberaciones",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/finanzas/conciliaciones-liberaciones");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SettlementReleasePage />
    </Suspense>
  ),
});
