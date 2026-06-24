import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { OutreachCampaignDetailPage } from "@/features/outreach/pages/OutreachCampaignDetailPage";

export const Route = createFileRoute("/_authed/outreach/campanas/$id")({
  staticData: {
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Detalle de campaña",
  },
  beforeLoad: requirePermission("read", "OutreachEstablishment"),
  component: OutreachCampaignDetailPage,
});
