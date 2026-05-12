import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudInboxPage } from "@/features/wa-cloud/pages/WaCloudInboxPage";

export const Route = createFileRoute("/_authed/wa-cloud/")({
  staticData: {
    nav: {
      iconKey: "MessageSquare",
      label: "WhatsApp Cloud",
      order: 10,
      section: "Comunicaciones",
    },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Bandeja",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudInboxPage,
});
