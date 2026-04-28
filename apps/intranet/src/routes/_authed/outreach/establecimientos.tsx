import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachEstablishmentsPage } from "@/features/outreach/pages/OutreachEstablishmentsPage";

export const Route = createFileRoute("/_authed/outreach/establecimientos")({
  staticData: {
    nav: { iconKey: "School", label: "Establecimientos", order: 2, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Establecimientos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachEstablishmentsPage,
});
