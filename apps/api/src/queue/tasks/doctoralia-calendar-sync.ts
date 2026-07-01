// graphile-worker task: Doctoralia calendar auto-sync from alerts.
// Triggered by parsedCronItems (gated by ENABLE_DOCTORALIA_CALENDAR_SYNC).
// Replaces the node-cron schedule in services/doctoralia-calendar-scheduler.ts.
// runDoctoraliaCalendarAutoSync keeps its own min-interval + running guards, so
// no extra overlap handling is needed here.

import type { Task } from "graphile-worker";
import { runDoctoraliaCalendarAutoSync } from "../../services/doctoralia-calendar-scheduler.ts";
import { feedDoctoraliaIdentity } from "../../services/identity-feeders.ts";

export const doctoralia_calendar_sync: Task = async (_payload, helpers) => {
  helpers.logger.info("doctoralia_calendar_sync.start");
  await runDoctoraliaCalendarAutoSync({ trigger: "cron:doctoralia_calendar_sync" });
  // Event-driven identity feed: resolve any freshly-synced appointments to
  // Person/Patient (incremental, DB-toggle gated). Failures here never fail the
  // calendar sync.
  await feedDoctoraliaIdentity("cron:doctoralia_calendar_sync").catch((err) => {
    helpers.logger.error(`doctoralia_calendar_sync.identity_feed_failed: ${String(err)}`);
  });
};
