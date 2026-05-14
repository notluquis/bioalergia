import { createFileRoute } from "@tanstack/react-router";

import { NotificationsSettingsPage } from "@/pages/settings/NotificationsSettingsPage";

export const Route = createFileRoute("/_authed/settings/notifications")({
  staticData: {
    nav: { iconKey: "Bell", label: "Notificaciones", order: 5, section: "Sistema" },
    title: "Notificaciones",
  },
  component: NotificationsSettingsPage,
});
