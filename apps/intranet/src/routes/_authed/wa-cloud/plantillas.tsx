import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudTemplatesPage } from "@/features/wa-cloud/pages/WaCloudTemplatesPage";

export const Route = createFileRoute("/_authed/wa-cloud/plantillas")({
  staticData: {
    nav: { iconKey: "ClipboardList", label: "WA Plantillas", order: 2, section: "Operaciones" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Plantillas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudTemplatesPage,
});
