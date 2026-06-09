import { createFileRoute } from "@tanstack/react-router";
import { OutreachDashboardPage } from "@/features/outreach/pages/OutreachDashboardPage";
import { requirePermission } from "@/lib/authz/route-guards";

export const Route = createFileRoute("/_authed/outreach/")({
  staticData: {
    nav: { iconKey: "GraduationCap", label: "Outreach", order: 10, section: "Outreach" },
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Outreach a Colegios",
  },
  beforeLoad: requirePermission("read", "OutreachEstablishment"),
  component: OutreachDashboardPage,
});
