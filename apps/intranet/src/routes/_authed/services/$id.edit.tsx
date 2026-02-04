import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { serviceQueries } from "@/features/services/queries";

const EditServicePage = lazy(() => import("@/features/services/pages/EditServicePage"));

export const Route = createFileRoute("/_authed/services/$id/edit")({
  beforeLoad: ({ context }) => {
    if (!context.can("update", "Service")) {
      const routeApi = getRouteApi("/_authed/services/$id/edit");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    return await queryClient.ensureQueryData(serviceQueries.detail(id));
  },
  staticData: {
    breadcrumb: (data: unknown) => {
      const service = data as { name?: string } | undefined;
      return `Editar ${service?.name || "Servicio"}`;
    },
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <EditServicePage />
    </Suspense>
  ),
});
