import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const RolesSettingsPage = lazy(() => import("@/pages/settings/RolesSettingsPage"));

export const Route = createFileRoute("/_authed/settings/roles")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Role")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <RolesSettingsPage />
    </Suspense>
  ),
});
