import { createFileRoute } from "@tanstack/react-router";

import { NotificationsSettingsPage } from "@/pages/settings/NotificationsSettingsPage";

export const Route = createFileRoute("/_authed/settings/notifications")({
  staticData: {
    nav: { iconKey: "Bell", label: "Notificaciones", order: 25, section: "Mi cuenta" },
    title: "Notificaciones",
  },
  component: NotificationsSettingsPage,
});
