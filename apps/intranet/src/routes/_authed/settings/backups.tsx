import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { BackupSettingsPage } from "@/pages/settings/BackupSettingsPage";

export const Route = createFileRoute("/_authed/settings/backups")({
  staticData: {
    nav: { iconKey: "HardDrive", label: "Backups", order: 30, section: "Sistema" },
    permission: { action: "read", subject: "Backup" },
    relatedSubjects: ["DebugToken", "Setting"],
    title: "Copias de seguridad",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Backup")) {
      const routeApi = getRouteApi("/_authed/settings/backups");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: BackupSettingsPage,
});
