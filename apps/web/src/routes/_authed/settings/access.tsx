import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const AccessSettingsPage = lazy(() => import("@/pages/settings/AccessSettingsPage"));

export const Route = createFileRoute("/_authed/settings/access")({
  staticData: {
    nav: { iconKey: "Settings2", label: "Ajustes", order: 3, section: "Sistema" },
    // Notice permission here is slightly different (update vs read usually), sticking to original route-data logic or best guess if not sure.
    // Original route-data access.tsx had 'update User'.
    permission: { action: "update", subject: "User" },
    title: "Ajustes de acceso",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "User")) {
      const routeApi = getRouteApi("/_authed/settings/access");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AccessSettingsPage />
    </Suspense>
  ),
});
