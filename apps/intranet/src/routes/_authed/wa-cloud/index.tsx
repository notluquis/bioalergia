import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudInboxPage } from "@/features/wa-cloud/pages/WaCloudInboxPage";

export const Route = createFileRoute("/_authed/wa-cloud/")({
  staticData: {
    nav: { iconKey: "MessageCircle", label: "WhatsApp Cloud", order: 1, section: "Operaciones" },
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
