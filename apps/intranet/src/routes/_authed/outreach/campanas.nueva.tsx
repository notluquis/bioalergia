import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachNewCampaignPage } from "@/features/outreach/pages/OutreachNewCampaignPage";

export const Route = createFileRoute("/_authed/outreach/campanas/nueva")({
  staticData: {
    permission: { action: "create", subject: "OutreachEstablishment" },
    title: "Nueva campaña",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachNewCampaignPage,
});
