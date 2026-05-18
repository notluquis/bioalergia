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
import { dte_sync } from "./dte-sync.ts";
import { orphan_cleanup } from "./orphan-cleanup.ts";

export const taskList: TaskList = {
  dte_sync,
  orphan_cleanup,
};
