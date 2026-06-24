import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { OutreachCampaignsPage } from "@/features/outreach/pages/OutreachCampaignsPage";

export const Route = createFileRoute("/_authed/outreach/campanas")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Campañas escuelas", order: 30, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Campañas",
  },
  beforeLoad: requirePermission("read", "OutreachEstablishment"),
  component: OutreachCampaignsPage,
});
