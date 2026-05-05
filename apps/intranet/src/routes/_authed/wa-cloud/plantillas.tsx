import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudTemplatesPage } from "@/features/wa-cloud/pages/WaCloudTemplatesPage";

export const Route = createFileRoute("/_authed/wa-cloud/plantillas")({
  staticData: {
    nav: { iconKey: "LayoutList", label: "Plantillas WA", order: 20, section: "Comunicaciones" },
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
