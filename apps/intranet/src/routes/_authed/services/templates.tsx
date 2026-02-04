import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const TemplatesPage = lazy(() => import("@/features/services/pages/TemplatesPage"));

export const Route = createFileRoute("/_authed/services/templates")({
  staticData: {
    nav: { iconKey: "FileSpreadsheet", label: "Plantillas", order: 2, section: "Servicios" },
    permission: { action: "read", subject: "ServiceTemplate" },
    title: "Plantillas de servicios",
    breadcrumb: "Plantillas",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "ServiceTemplate")) {
      const routeApi = getRouteApi("/_authed/services/templates");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TemplatesPage />
    </Suspense>
  ),
});
