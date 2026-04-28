import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachCampaignsPage } from "@/features/outreach/pages/OutreachCampaignsPage";

export const Route = createFileRoute("/_authed/outreach/campanas")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Campañas", order: 3, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Campañas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachCampaignsPage,
});
