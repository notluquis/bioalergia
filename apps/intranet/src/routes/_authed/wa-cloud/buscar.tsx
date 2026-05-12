import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudSearchPage } from "@/features/wa-cloud/pages/WaCloudSearchPage";

export const Route = createFileRoute("/_authed/wa-cloud/buscar")({
  staticData: {
    nav: { iconKey: "Search", label: "WA Buscar", order: 105, section: "Sistema" },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Buscar",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudSearchPage,
});
