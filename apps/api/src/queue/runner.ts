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

  const parsedCronItems = parseCronItems([
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
  ]);

  runner = await run({
    connectionString,
    maxPoolSize: 2,
    schema: "graphile_worker",
    concurrency: 3,
    noHandleSignals: false,
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
    cronJobs: 2,
    tz: process.env.TZ ?? "(unset → UTC; set TZ=America/Santiago)",
  });
}
