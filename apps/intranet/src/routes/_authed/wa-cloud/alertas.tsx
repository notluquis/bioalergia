import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudAlertsPage } from "@/features/wa-cloud/pages/WaCloudAlertsPage";

export const Route = createFileRoute("/_authed/wa-cloud/alertas")({
  staticData: {
    nav: { iconKey: "Bell", label: "WA Alertas", order: 108, section: "Sistema" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Alertas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudAlertsPage,
});
