import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { serviceQueries } from "@/features/services/queries";
import { ServicesPage } from "@/features/services/pages/ServicesPage";

// Services index - shows the services page with tabs (overview + agenda)
export const Route = createFileRoute("/_authed/services/")({
  staticData: {
    nav: { iconKey: "Briefcase", label: "Servicios", order: 30, section: "Pacientes" },
    permission: { action: "read", subject: "ServiceList" },
    relatedSubjects: ["ServiceAgenda", "ServiceSchedule", "ServiceTemplate"],
    breadcrumb: "Servicios",
    title: "Servicios",
  },
  beforeLoad: requirePermission("read", "ServiceList"),
  component: ServicesPage,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(serviceQueries.list());
  },
});
