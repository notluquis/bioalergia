import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const AccessSettingsPage = lazy(() => import("@/pages/settings/AccessSettingsPage"));

export const Route = createFileRoute("/_authed/settings/access")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "User")) {
      const routeApi = getRouteApi("/_authed/settings/access");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AccessSettingsPage />
    </Suspense>
  ),
});
