import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { OutreachNewCampaignPage } from "@/features/outreach/pages/OutreachNewCampaignPage";

export const Route = createFileRoute("/_authed/outreach/campanas/nueva")({
  staticData: {
    permission: { action: "create", subject: "OutreachEstablishment" },
    title: "Nueva campaña",
  },
  beforeLoad: requirePermission("create", "OutreachEstablishment"),
  component: OutreachNewCampaignPage,
});
