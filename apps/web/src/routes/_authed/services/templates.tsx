import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const TemplatesPage = lazy(() => import("@/features/services/pages/TemplatesPage"));

export const Route = createFileRoute("/_authed/services/templates")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "ServiceTemplate")) {
      const routeApi = getRouteApi("/_authed/services/templates");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TemplatesPage />
    </Suspense>
  ),
});
