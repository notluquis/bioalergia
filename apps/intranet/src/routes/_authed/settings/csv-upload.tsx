import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CSVUploadPage = lazy(() => import("@/pages/settings/CSVUploadPage"));

export const Route = createFileRoute("/_authed/settings/csv-upload")({
  staticData: {
    nav: { iconKey: "Upload", label: "Carga Masiva", order: 4, section: "Sistema" },
    permission: { action: "create", subject: "BulkData" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "BulkData")) {
      const routeApi = getRouteApi("/_authed/settings/csv-upload");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CSVUploadPage />
    </Suspense>
  ),
});
