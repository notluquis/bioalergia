import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const ServicesPage = lazy(() =>
  import("@/features/services/pages/ServicesPage").then((m) => ({
    default: m.ServicesPage,
  })),
);

import { serviceQueries } from "@/features/services/queries";

// Services index - shows the services page with tabs (overview + agenda)
export const Route = createFileRoute("/_authed/services/")({
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ServiceList")) {
      const routeApi = getRouteApi("/_authed/services/");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ServicesPage />
    </Suspense>
  ),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(serviceQueries.list(true));
  },
});
