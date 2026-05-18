// Phase 4b IA consolidation panel — re-export of the existing notifications
// settings page so the `/account?tab=notificaciones` host can mount it as a
// tab panel. Push-preview privacy is a per-user preference and now lives
// under the user account page.

export { NotificationsSettingsPage as NotificationsPanel } from "@/pages/settings/NotificationsSettingsPage";
