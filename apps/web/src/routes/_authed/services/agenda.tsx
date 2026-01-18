import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { serviceQueries } from "@/features/services/queries";

const AgendaPage = lazy(() => import("@/features/services/pages/AgendaPage"));

export const Route = createFileRoute("/_authed/services/agenda")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "ServiceAgenda")) {
      const routeApi = getRouteApi("/_authed/services/agenda");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AgendaPage />
    </Suspense>
  ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(serviceQueries.list());
  },
});
