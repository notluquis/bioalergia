import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CSVUploadPage } from "@/pages/settings/CSVUploadPage";

export const Route = createFileRoute("/_authed/settings/csv-upload")({
  staticData: {
    nav: { iconKey: "Upload", label: "Carga Masiva", order: 40, section: "Sistema" },
    permission: { action: "create", subject: "BulkData" },
    title: "Configuración — Carga masiva",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "BulkData")) {
      const routeApi = getRouteApi("/_authed/settings/csv-upload");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: CSVUploadPage,
});
