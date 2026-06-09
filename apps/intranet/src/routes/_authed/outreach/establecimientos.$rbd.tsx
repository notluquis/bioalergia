import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { OutreachEstablishmentDetailPage } from "@/features/outreach/pages/OutreachEstablishmentDetailPage";

export const Route = createFileRoute("/_authed/outreach/establecimientos/$rbd")({
  staticData: {
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Detalle de establecimiento",
  },
  beforeLoad: requirePermission("read", "OutreachEstablishment"),
  component: OutreachEstablishmentDetailPage,
});
