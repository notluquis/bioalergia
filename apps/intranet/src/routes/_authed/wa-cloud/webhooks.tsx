import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudWebhookLogsPage } from "@/features/wa-cloud/pages/WaCloudWebhookLogsPage";

export const Route = createFileRoute("/_authed/wa-cloud/webhooks")({
  staticData: {
    nav: { iconKey: "Webhook", label: "WA Webhooks", order: 100, section: "Sistema" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Webhook logs",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudWebhookLogsPage,
});
