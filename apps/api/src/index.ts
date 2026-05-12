// apps/api/src/index.ts - Server Entry Point
import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { runSequenceHealthCheck } from "./lib/db-sequence-health.ts";
import { startOrphanCleanupScheduler } from "./lib/orphan-cleanup-scheduler.ts";
import { startDoctoraliaCalendarScheduler } from "./lib/doctoralia/doctoralia-calendar-scheduler.ts";
import { startDoctoraliaImapListener } from "./lib/doctoralia/imap-idle.ts";
import { startDTESyncScheduler } from "./lib/dte/dte-sync-cron.ts";
import { startClinicalSkinTestImportScheduler } from "./lib/clinical-skin-tests/clinical-skin-test-scheduler.ts";
import { startGoogleCalendarScheduler } from "./lib/google/google-calendar-scheduler.ts";
import { scheduleWatchChannelSetup } from "./lib/google/google-calendar-watch.ts";
import { startBroadcastRunner } from "./modules/wa-cloud/broadcast-runner.ts";
import { startScheduledMessageRunner } from "./modules/wa-cloud/scheduled-sender.ts";

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

// Boot-time integrity sweep: warn (and auto-repair in prod) any id
// sequence whose nextval() has fallen behind MAX(id). Runs in the
// background so a slow check never blocks the HTTP listener coming up.
void runSequenceHealthCheck();

// Nightly orphan cleanup (clinical_series → patients → people, all
// cascade-safe). Gated by DB_ORPHAN_CLEANUP=1 inside the sweep itself,
// so an absent flag downgrades to a dry-run that just logs counts.
startOrphanCleanupScheduler();

// Initialize Calendar features (Scheduler + Watch Channels)
// Run this after server starts to avoid blocking startup (though these are async anyway)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CALENDAR_SYNC === "true") {
  startGoogleCalendarScheduler();
  scheduleWatchChannelSetup();
}

// DTE Sync Scheduler (daily at 17:00)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_DTE_AUTO_SYNC === "true") {
  startDTESyncScheduler();
}

if (process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC === "true") {
  startDoctoraliaCalendarScheduler();
}

if (process.env.ENABLE_DOCTORALIA_IMAP === "true") {
  startDoctoraliaImapListener();
}

if (process.env.ENABLE_SKIN_TEST_IMPORT_SYNC === "true") {
  startClinicalSkinTestImportScheduler();
}

// WA Cloud scheduled message runner (always-on; cheap 30s poll)
startScheduledMessageRunner();
startBroadcastRunner();

serve({ fetch: app.fetch, port });
