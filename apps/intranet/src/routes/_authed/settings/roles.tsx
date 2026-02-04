import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const RolesSettingsPage = lazy(() => import("@/pages/settings/RolesSettingsPage"));

export const Route = createFileRoute("/_authed/settings/roles")({
  staticData: {
    nav: { iconKey: "UserCog", label: "Roles", order: 2, section: "Sistema" },
    permission: { action: "read", subject: "Role" },
    title: "Roles y permisos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Role")) {
      const routeApi = getRouteApi("/_authed/settings/roles");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <RolesSettingsPage />
    </Suspense>
  ),
});
