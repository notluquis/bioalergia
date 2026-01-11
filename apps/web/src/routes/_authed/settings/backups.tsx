import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const BackupSettingsPage = lazy(() => import("@/pages/settings/BackupSettingsPage"));

export const Route = createFileRoute("/_authed/settings/backups")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Backup")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <BackupSettingsPage />
    </Suspense>
  ),
});
