import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const OverviewPage = lazy(() =>
  import("@/features/services/pages/OverviewPage").then((m) => ({
    default: m.ServicesOverviewPage,
  })),
);

import { serviceQueries } from "@/features/services/queries";

// Services index - shows the overview page
export const Route = createFileRoute("/_authed/services/")({
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ServiceList")) {
      const routeApi = getRouteApi("/_authed/services/");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <OverviewPage />
    </Suspense>
  ),

  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(serviceQueries.list(true));
  },
});
