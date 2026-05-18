import { CalendarSyncHistoryPage } from "@/pages/CalendarSyncHistoryPage";

/**
 * `/calendar?tab=historial` panel — was `/calendar/sync-history`.
 *
 * Sync history + manual trigger + sync progress. Wraps the original
 * page so the migration is surface-only (no behavior diff).
 */
export function CalendarSyncHistoryPanel() {
  return <CalendarSyncHistoryPage />;
}
