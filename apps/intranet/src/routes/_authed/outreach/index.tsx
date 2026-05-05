import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachDashboardPage } from "@/features/outreach/pages/OutreachDashboardPage";

export const Route = createFileRoute("/_authed/outreach/")({
  staticData: {
    nav: { iconKey: "GraduationCap", label: "Outreach", order: 10, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Outreach a Colegios",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachDashboardPage,
});
