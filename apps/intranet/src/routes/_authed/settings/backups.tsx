import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const BackupSettingsPage = lazy(() => import("@/pages/settings/BackupSettingsPage"));

export const Route = createFileRoute("/_authed/settings/backups")({
  staticData: {
    nav: { iconKey: "Database", label: "Backups", order: 4, section: "Sistema" },
    permission: { action: "read", subject: "Backup" },
    title: "Copias de seguridad",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Backup")) {
      const routeApi = getRouteApi("/_authed/settings/backups");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <BackupSettingsPage />
    </Suspense>
  ),
});
