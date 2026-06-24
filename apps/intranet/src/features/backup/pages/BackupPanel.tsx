// Phase 4b IA consolidation panel — re-export of the existing backups
// settings page so the `/admin/database?tab=backups` host can mount it as
// a tab panel without duplicating the implementation.

export { BackupSettingsPage as BackupPanel } from "@/pages/settings/BackupSettingsPage";
