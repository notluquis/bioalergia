import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudScheduledPage } from "@/features/wa-cloud/pages/WaCloudScheduledPage";

export const Route = createFileRoute("/_authed/wa-cloud/programados")({
  staticData: {
    nav: { iconKey: "CalendarClock", label: "WA Programados", order: 30, section: "Comunicaciones" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Programados",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudScheduledPage,
});
