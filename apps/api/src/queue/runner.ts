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

import { run, parseCronItems, type Runner } from "graphile-worker";
import { logError, logEvent } from "../lib/logger.ts";
import { taskList } from "./tasks/index.ts";

let runner: Runner | null = null;

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
  ];

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
