import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { Supplies } from "@/features/supplies/pages/SuppliesPage";

export const Route = createFileRoute("/_authed/operations/supplies")({
  staticData: {
    nav: { iconKey: "PackagePlus", label: "Solicitudes", order: 10, section: "Logística" },
    permission: { action: "read", subject: "SupplyRequest" },
    title: "Solicitudes de insumos",
  },
  beforeLoad: requirePermission("read", "SupplyRequest"),
  component: Supplies,

  loader: async ({ context: { queryClient } }) => {
    const { supplyQueries } = await import("@/features/supplies/queries");
    await Promise.all([
      queryClient.ensureQueryData(supplyQueries.requests()),
      queryClient.ensureQueryData(supplyQueries.common()),
    ]);
  },
});
