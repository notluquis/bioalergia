import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachCampaignDetailPage } from "@/features/outreach/pages/OutreachCampaignDetailPage";

export const Route = createFileRoute("/_authed/outreach/campanas/$id")({
  staticData: {
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Detalle de campaña",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachCampaignDetailPage,
});
