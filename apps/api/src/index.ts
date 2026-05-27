// apps/api/src/index.ts - Server Entry Point
import "./instrument.ts"; // MUST be first — Sentry instruments http/fetch on import
import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { runSequenceHealthCheck } from "./lib/db-sequence-health.ts";
import { scheduleWatchChannelSetup } from "./lib/google/google-calendar-watch.ts";
import { startQueueRunner } from "./queue/runner.ts";

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

// Boot-time integrity sweep (background, non-blocking).
void runSequenceHealthCheck();

// Google Calendar uses Push Notifications (watch channels) → webhook-driven,
// no polling required. Schedule channel renewal only.
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CALENDAR_SYNC === "true") {
  scheduleWatchChannelSetup();
}

// graphile-worker queue: handles DTE daily sync + nightly orphan cleanup via
// parsedCronItems. Replaces in-process node-cron schedulers and their
// closures/timer refs. LISTEN/NOTIFY = event-driven, near-zero idle cost.
//
// WA scheduled / broadcast pollers REMOVED: createBroadcast / scheduleMessage
// oRPC handlers don't exist yet (frontend hook calls 404), so the 5s/30s
// setInterval polls were running over empty tables. When those handlers are
// implemented, enqueue jobs via SQL `graphile_worker.add_job(...)` inside the
// same Kysely transaction that inserts the row.
if (process.env.DISABLE_QUEUE_RUNNER !== "true") {
  void startQueueRunner().catch((err) => {
    console.error("[queue.runner] failed to start", err);
  });
}

// Doctoralia calendar sync + skin-test import sync + OneDrive renewal are now
// graphile-worker cron tasks (queue/runner.ts), gated by the same ENABLE_*
// flags. Only the IMAP listener remains a direct startup here.
if (process.env.ENABLE_DOCTORALIA_IMAP === "true") {
  const { startDoctoraliaImapListener } = await import("./lib/doctoralia/imap-idle.ts");
  startDoctoraliaImapListener();
}

serve({ fetch: app.fetch, port });
