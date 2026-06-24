import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { serviceQueries } from "@/features/services/queries";
import { ServiceEditPage } from "@/features/services/pages/EditServicePage";

export const Route = createFileRoute("/_authed/services/$id/edit")({
  beforeLoad: requirePermission("update", "Service"),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    return await queryClient.ensureQueryData(serviceQueries.detail(id));
  },
  staticData: {
    breadcrumb: (data: unknown) => {
      const service = data as { name?: string } | undefined;
      return `Editar ${service?.name || "Servicio"}`;
    },
    title: "Editar servicio",
  },
  component: ServiceEditPage,
});
