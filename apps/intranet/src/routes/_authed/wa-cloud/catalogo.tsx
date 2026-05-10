import { createFileRoute, redirect } from "@tanstack/react-router";
import { WaCloudCatalogPage } from "@/features/wa-cloud/pages/WaCloudCatalogPage";

export const Route = createFileRoute("/_authed/wa-cloud/catalogo")({
  staticData: {
    nav: { iconKey: "Library", label: "WA Catálogo", order: 115, section: "Sistema" },
    permission: { action: "create", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Catálogo",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudCatalogPage,
});
