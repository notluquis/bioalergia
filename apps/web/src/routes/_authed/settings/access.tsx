import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const AccessSettingsPage = lazy(() => import("@/pages/settings/AccessSettingsPage"));

export const Route = createFileRoute("/_authed/settings/access")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "User")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AccessSettingsPage />
    </Suspense>
  ),
});
