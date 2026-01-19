import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ReleasesPage = lazy(() => import("@/features/finance/mercadopago/pages/ReleaseTransactionsPage"));

export const Route = createFileRoute("/_authed/finanzas/liberaciones")({
  staticData: {
    nav: { iconKey: "Wallet", label: "Liberaciones", order: 3, section: "Finanzas" },
    permission: { action: "read", subject: "Integration" },
    title: "Liberaciones",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/finanzas/liberaciones");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ReleasesPage />
    </Suspense>
  ),
});
