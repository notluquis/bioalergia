import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SuppliesPage = lazy(() => import("@/features/operations/supplies/pages/SuppliesPage"));

export const Route = createFileRoute("/_authed/operations/supplies")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "SupplyRequest")) {
      const routeApi = getRouteApi("/_authed/operations/supplies");
      throw routeApi.redirect({ to: "/" });
    }
  },
  loader: async ({ context: { queryClient } }) => {
    const { supplyQueries } = await import("@/features/supplies/queries");
    await Promise.all([
      queryClient.ensureQueryData(supplyQueries.requests()),
      queryClient.ensureQueryData(supplyQueries.common()),
    ]);
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SuppliesPage />
    </Suspense>
  ),
});
