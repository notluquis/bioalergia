// graphile-worker task registry. Add new tasks here.
//
// Naming: snake_case identifiers (graphile-worker convention). Each task is
// `Task<PayloadType>` from graphile-worker. Payloads should be JSON-serializable.
//
// Future WA tasks (when createBroadcast / scheduleMessage handlers land):
//   send_wa_scheduled: Task<{ scheduledMessageId: number }>
//   send_wa_broadcast_tick: Task<{ broadcastId: number }>
// Enqueue from oRPC handlers via SQL `SELECT graphile_worker.add_job(...)`
// inside the same Kysely transaction that creates the row (atomic enqueue).

import type { TaskList } from "graphile-worker";
import { doctoralia_calendar_sync } from "./doctoralia-calendar-sync.ts";
import { dte_sync } from "./dte-sync.ts";
import { job_radar_sync } from "./job-radar-sync.ts";
import { onedrive_renew } from "./onedrive-renew.ts";
import { orphan_cleanup } from "./orphan-cleanup.ts";
import { skin_test_sync } from "./skin-test-sync.ts";

export const taskList: TaskList = {
  dte_sync,
  orphan_cleanup,
  skin_test_sync,
  onedrive_renew,
  doctoralia_calendar_sync,
  job_radar_sync,
};
