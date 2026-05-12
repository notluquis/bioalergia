import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudBroadcastsPage } from "@/features/wa-cloud/pages/WaCloudBroadcastsPage";

export const Route = createFileRoute("/_authed/wa-cloud/broadcasts")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Campañas WA", order: 25, section: "Comunicaciones" },
    permission: { action: "create", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Campañas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudBroadcastsPage,
});
