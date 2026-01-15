import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ReleasesPage = lazy(() => import("@/features/finance/mercadopago/pages/ReleaseTransactionsPage"));

export const Route = createFileRoute("/_authed/finanzas/liberaciones")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/finanzas/liberaciones");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ReleasesPage />
    </Suspense>
  ),
});
