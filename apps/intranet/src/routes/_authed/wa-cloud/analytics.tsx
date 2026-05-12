import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudAnalyticsPage } from "@/features/wa-cloud/pages/WaCloudAnalyticsPage";

export const Route = createFileRoute("/_authed/wa-cloud/analytics")({
  staticData: {
    nav: { iconKey: "BarChart3", label: "WA Analíticas", order: 105, section: "Sistema" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Analíticas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudAnalyticsPage,
});
