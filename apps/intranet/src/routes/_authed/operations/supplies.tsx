import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SuppliesPage = lazy(() => import("@/features/operations/supplies/pages/SuppliesPage"));

export const Route = createFileRoute("/_authed/operations/supplies")({
  staticData: {
    nav: { iconKey: "PackagePlus", label: "Solicitudes", order: 2, section: "Insumos" },
    permission: { action: "read", subject: "SupplyRequest" },
    title: "Solicitudes de insumos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "SupplyRequest")) {
      const routeApi = getRouteApi("/_authed/operations/supplies");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SuppliesPage />
    </Suspense>
  ),
  loader: async ({ context: { queryClient } }) => {
    const { supplyQueries } = await import("@/features/supplies/queries");
    await Promise.all([
      queryClient.ensureQueryData(supplyQueries.requests()),
      queryClient.ensureQueryData(supplyQueries.common()),
    ]);
  },
});
