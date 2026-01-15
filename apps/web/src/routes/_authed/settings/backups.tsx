import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const BackupSettingsPage = lazy(() => import("@/pages/settings/BackupSettingsPage"));

export const Route = createFileRoute("/_authed/settings/backups")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Backup")) {
      const routeApi = getRouteApi("/_authed/settings/backups");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <BackupSettingsPage />
    </Suspense>
  ),
});
