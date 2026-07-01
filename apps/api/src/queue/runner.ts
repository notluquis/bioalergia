// graphile-worker runner — boots inside the api process.
//
// Why in-process (vs separate Railway service):
// - LISTEN/NOTIFY = zero polling; idle cost ~0 CPU, ~5MB heap.
// - +1 Railway service avoided (saves RAM-hour cost).
//
// Uses its own small pg pool (2 connections: 1 LISTEN + 1 work slot) instead
// of sharing the app pool, so worker traffic never starves Kysely queries.
//
// Cron timezone: relies on TZ env (set TZ=America/Santiago on the api service).
// graphile-worker has no per-cron-item TZ option; the process timezone applies.
//
// Replaces:
// - node-cron startDTESyncScheduler (daily 17:00) → cron item dte_sync
// - node-cron startOrphanCleanupScheduler (nightly 03:30) → cron item orphan_cleanup
// - setInterval WA pollers — DEFERRED until createBroadcast / scheduleMessage
//   handlers exist (currently no rows are ever created, polling was waste).

import { run, parseCronItems, type Runner, type TaskSpec } from "graphile-worker";
import { logError, logEvent } from "../lib/logger.ts";
import { getSetting } from "../lib/settings.ts";
import { taskList } from "./tasks/index.ts";

let runner: Runner | null = null;

/**
 * Enqueue a job onto the in-process queue. No-op (logged) when the runner is
 * disabled (DISABLE_QUEUE_RUNNER) or not yet booted — callers must keep a
 * manual fallback path. Used e.g. by launchCampaign to kick off the outreach
 * auto-drain chain.
 */
export async function enqueueJob(
  identifier: string,
  payload: Record<string, unknown>,
  spec?: TaskSpec
): Promise<boolean> {
  if (!runner) {
    logEvent("queue.enqueue.skipped", { identifier, reason: "runner-unavailable" });
    return false;
  }
  await runner.addJob(identifier, payload, spec);
  return true;
}

export async function startQueueRunner(): Promise<void> {
  if (runner) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logError("queue.runner.no-database-url", new Error("DATABASE_URL missing"));
    return;
  }

  // Cron timezone: graphile-worker has no per-item TZ; it uses the process TZ
  // (set TZ=America/Santiago on the api service). Interval crons (*/N) are
  // TZ-insensitive anyway.
  const cronItems = [
    {
      task: "dte_sync",
      match: "0 17 * * *",
      identifier: "dte_sync",
      options: { backfillPeriod: 0 },
    },
    {
      task: "orphan_cleanup",
      match: "30 3 * * *",
      identifier: "orphan_cleanup",
      options: { backfillPeriod: 0 },
    },
    {
      // Nightly audit-log HMAC chain verification (tamper-evidence on the
      // ficha access log). 05:00 America/Santiago, after orphan_cleanup.
      task: "audit_chain_verify",
      match: "0 5 * * *",
      identifier: "audit_chain_verify",
      options: { backfillPeriod: 0 },
    },
    {
      // Automated PII retention sweep (Ley 21.719). 04:00 America/Santiago,
      // after orphan_cleanup (03:30), before audit_chain_verify (05:00).
      // Deletes/anonymizations gated by DB_RETENTION_SWEEP=1 (unset = dry-run).
      // Clinical/ficha tables are hard-guarded — never swept.
      task: "retention_sweep",
      match: "0 4 * * *",
      identifier: "retention_sweep",
      options: { backfillPeriod: 0 },
    },
    {
      // Daily pollen forecast cache refresh (widget /polen). 06:00
      // America/Santiago. No-op si falta GOOGLE_PLACES_API_KEY.
      task: "pollen_sync",
      match: "0 6 * * *",
      identifier: "pollen_sync",
      options: { backfillPeriod: 0 },
    },
    {
      // Retry abono WhatsApp sends that failed transiently (request +
      // confirmation). Bounded scans → no-op when nothing is pending.
      task: "abono_wa_retry",
      match: "*/10 * * * *",
      identifier: "abono_wa_retry",
      options: { backfillPeriod: 0 },
    },
    {
      // Expire stale stock reservations (TTL passed) so declined/abandoned
      // checkouts return held stock without waiting for the next reserve()
      // lazy-cleanup. TZ-insensitive interval.
      task: "reservation_sweep",
      match: "*/10 * * * *",
      identifier: "reservation_sweep",
      options: { backfillPeriod: 0 },
    },
    {
      // Cancel abandoned (PENDING > 3 days, never paid) shop orders + release
      // any stock still held for them. 03:00 America/Santiago.
      task: "abandoned_order_sweep",
      match: "30 3 * * *",
      identifier: "abandoned_order_sweep",
      options: { backfillPeriod: 0 },
    },
    // Identity-hub feeders (gated by IDENTITY_FEEDERS_ENABLED — no-op otherwise).
    // Staggered across the late-night window; each is idempotent.
    {
      task: "doctoralia_identity_sync",
      match: "0 22 * * *",
      identifier: "doctoralia_identity_sync",
      options: { backfillPeriod: 0 },
    },
    {
      task: "dte_titular_sync",
      match: "0 23 * * *",
      identifier: "dte_titular_sync",
      options: { backfillPeriod: 0 },
    },
    {
      task: "identity_series_backfill",
      match: "30 23 * * *",
      identifier: "identity_series_backfill",
      options: { backfillPeriod: 0 },
    },
  ];

  // Breach / anomaly detection over audit_logs (ANCI 3h alert chain). Schedule
  // read from DB (security.anomalyCron) at boot, default every 15 min. The
  // thresholds themselves are read fresh per tick inside the task (no restart
  // needed to tune them).
  const anomalyCron =
    (await getSetting("security.anomalyCron")) || process.env.AUDIT_ANOMALY_CRON || "*/15 * * * *";
  cronItems.push({
    task: "audit_anomaly",
    match: anomalyCron,
    identifier: "audit_anomaly",
    options: { backfillPeriod: 0 },
  });

  // Skin-test import sync + OneDrive subscription renewal — gated by the same
  // flag the old node-cron scheduler used.
  if (process.env.ENABLE_SKIN_TEST_IMPORT_SYNC === "true") {
    cronItems.push(
      {
        task: "skin_test_sync",
        match: process.env.SKIN_TEST_IMPORT_SYNC_CRON || "*/30 * * * *",
        identifier: "skin_test_sync",
        options: { backfillPeriod: 0 },
      },
      {
        task: "onedrive_renew",
        match: "0 */6 * * *",
        identifier: "onedrive_renew",
        options: { backfillPeriod: 0 },
      }
    );
  }

  // Doctoralia calendar auto-sync — gated by its flag.
  if (process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC === "true") {
    cronItems.push({
      task: "doctoralia_calendar_sync",
      match: process.env.DOCTORALIA_CALENDAR_SYNC_CRON || "*/10 * * * *",
      identifier: "doctoralia_calendar_sync",
      options: { backfillPeriod: 0 },
    });
  }

  // Job Radar — scrape de ofertas de empleo + alerta Telegram. El cron se
  // registra SIEMPRE; el on/off vive en DB (`jobRadar.enabled`) y lo chequea
  // el task en cada tick (toggle sin reiniciar). El schedule sí se lee al boot.
  const jobRadarCron =
    (await getSetting("jobRadar.cron")) || process.env.JOB_RADAR_CRON || "*/30 * * * *";
  cronItems.push({
    task: "job_radar_sync",
    match: jobRadarCron,
    identifier: "job_radar_sync",
    options: { backfillPeriod: 0 },
  });

  const parsedCronItems = parseCronItems(cronItems);

  runner = await run({
    connectionString,
    // Pool = 1 LISTEN + concurrency work slots. concurrency 1 matches the
    // RAM-minimal design (heavy sequential syncs, no parallelism needed) and
    // keeps maxPoolSize (2) > concurrency — graphile-worker warns otherwise.
    maxPoolSize: 2,
    schema: "graphile_worker",
    concurrency: 1,
    // We own process signals (index.ts) so HTTP can drain in-flight requests
    // before the worker stops. With noHandleSignals:false, graphile-worker
    // hijacks SIGTERM, logs the graceful shutdown at ERROR level (0.16.6) and
    // re-raises the signal to self-kill — bypassing the HTTP server drain.
    noHandleSignals: true,
    taskList,
    parsedCronItems,
  });

  runner.events.on("job:error", ({ job, error }) => {
    logError("queue.job.error", error, {
      taskIdentifier: job.task_identifier,
      attempts: job.attempts,
      jobId: job.id,
    });
  });

  logEvent("queue.runner.started", {
    schema: "graphile_worker",
    tasks: Object.keys(taskList),
    cronJobs: parsedCronItems.length,
    tz: process.env.TZ ?? "(unset → UTC; set TZ=America/Santiago)",
  });
}

/**
 * Gracefully stop the queue runner: stop accepting new jobs and wait for
 * in-flight ones to finish. Called from the process shutdown handler
 * (index.ts) since we set noHandleSignals:true. Idempotent.
 */
export async function stopQueueRunner(): Promise<void> {
  if (!runner) return;
  const r = runner;
  runner = null;
  await r.stop();
  logEvent("queue.runner.stopped", {});
}
