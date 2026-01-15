import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const RolesSettingsPage = lazy(() => import("@/pages/settings/RolesSettingsPage"));

export const Route = createFileRoute("/_authed/settings/roles")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Role")) {
      const routeApi = getRouteApi("/_authed/settings/roles");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <RolesSettingsPage />
    </Suspense>
  ),
});
