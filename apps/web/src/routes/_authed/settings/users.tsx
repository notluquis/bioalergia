import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const UserManagementPage = lazy(() => import("@/features/users/pages/UserManagementPage"));

export const Route = createFileRoute("/_authed/settings/users")({
  staticData: {
    nav: { iconKey: "Users", label: "Usuarios", order: 1, section: "Sistema" },
    permission: { action: "read", subject: "User" },
    title: "Gestión de usuarios",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "User")) {
      const routeApi = getRouteApi("/_authed/settings/users");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <UserManagementPage />
    </Suspense>
  ),
});
