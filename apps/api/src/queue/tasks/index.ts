// graphile-worker task registry. Add new tasks here.
//
// Naming: snake_case identifiers (graphile-worker convention). Each task is
// `Task<PayloadType>` from graphile-worker. Payloads should be JSON-serializable.
//
// WA tasks: send_wa_broadcast_tick<{ broadcastId }> (drain a broadcast) and
// send_wa_scheduled<{ scheduledMessageId }> (one scheduled message at due time).
// Both enqueued by their oRPC handlers via enqueueJob() (mirrors outreach).

import type { TaskList } from "graphile-worker";
import { audit_chain_verify } from "./audit-chain-verify.ts";
import { doctoralia_calendar_sync } from "./doctoralia-calendar-sync.ts";
import { dte_sync } from "./dte-sync.ts";
import { job_radar_sync } from "./job-radar-sync.ts";
import { onedrive_renew } from "./onedrive-renew.ts";
import { orphan_cleanup } from "./orphan-cleanup.ts";
import { send_outreach_tick } from "./outreach-send.ts";
import { send_wa_broadcast_tick } from "./wa-broadcast-tick.ts";
import { send_wa_scheduled } from "./wa-scheduled-send.ts";
import { skin_test_sync } from "./skin-test-sync.ts";

export const taskList: TaskList = {
  dte_sync,
  orphan_cleanup,
  audit_chain_verify,
  skin_test_sync,
  onedrive_renew,
  doctoralia_calendar_sync,
  job_radar_sync,
  send_outreach_tick,
  send_wa_broadcast_tick,
  send_wa_scheduled,
};
