import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudSettingsPage } from "@/features/wa-cloud/pages/WaCloudSettingsPage";

export const Route = createFileRoute("/_authed/wa-cloud/configuracion")({
  staticData: {
    nav: { iconKey: "Settings2", label: "WA Configuración", order: 110, section: "Sistema" },
    permission: { action: "update", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Configuración",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudSettingsPage,
});
