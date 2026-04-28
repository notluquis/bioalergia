import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachImportPage } from "@/features/outreach/pages/OutreachImportPage";

export const Route = createFileRoute("/_authed/outreach/importar")({
  staticData: {
    nav: { iconKey: "Upload", label: "Importar MINEDUC", order: 4, section: "Outreach" },
    permission: { action: "create", subject: "OutreachEstablishment" },
    title: "Importar MINEDUC",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachImportPage,
});
