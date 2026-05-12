import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachDiscoverPage } from "@/features/outreach/pages/OutreachDiscoverPage";

export const Route = createFileRoute("/_authed/outreach/descubrir")({
  staticData: {
    nav: { iconKey: "SearchCode", label: "Descubrir", order: 40, section: "Outreach" },
    permission: { action: "create", subject: "OutreachEstablishment" },
    title: "Descubrir empresas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachDiscoverPage,
});
