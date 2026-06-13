// graphile-worker task registry. Add new tasks here.
//
// Naming: snake_case identifiers (graphile-worker convention). Each task is
// `Task<PayloadType>` from graphile-worker. Payloads should be JSON-serializable.
//
// WA broadcast drain: send_wa_broadcast_tick<{ broadcastId }> — enqueued by the
// createBroadcast/startBroadcast handlers via enqueueJob() (mirrors outreach).
// (send_wa_scheduled<{ scheduledMessageId }> still pending — the scheduleMessage
// handler creates rows but no sender consumes them yet.)

import type { TaskList } from "graphile-worker";
import { doctoralia_calendar_sync } from "./doctoralia-calendar-sync.ts";
import { dte_sync } from "./dte-sync.ts";
import { job_radar_sync } from "./job-radar-sync.ts";
import { onedrive_renew } from "./onedrive-renew.ts";
import { orphan_cleanup } from "./orphan-cleanup.ts";
import { send_outreach_tick } from "./outreach-send.ts";
import { send_wa_broadcast_tick } from "./wa-broadcast-tick.ts";
import { skin_test_sync } from "./skin-test-sync.ts";

export const taskList: TaskList = {
  dte_sync,
  orphan_cleanup,
  skin_test_sync,
  onedrive_renew,
  doctoralia_calendar_sync,
  job_radar_sync,
  send_outreach_tick,
  send_wa_broadcast_tick,
};
