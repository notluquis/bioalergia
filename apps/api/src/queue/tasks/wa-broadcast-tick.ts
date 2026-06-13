// graphile-worker task: drain a single WhatsApp broadcast.
//
// Enqueued by createBroadcast (scheduled) / startBroadcast (jobKey
// `wa_broadcast_<id>`, replace mode → one chain per broadcast). Each tick sends
// one burst via sendBroadcastNextBatch (which owns the RED-quality gate,
// per-second pacing and status bookkeeping) and re-enqueues itself until the
// broadcast finishes (remaining 0) or leaves SENDING (cancelled/failed).
//
// Re-enqueue gap: sendBroadcastNextBatch already sleeps intervalMs per recipient
// inside the burst, so a short fixed gap between ticks is enough to avoid
// busy-spinning while still respecting the per-second cap.

import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import {
  sendBroadcastNextBatch,
  waBroadcastJobKey,
} from "../../modules/wa-cloud/broadcast-runner.ts";

const RE_ENQUEUE_GAP_MS = 3_000;

export const send_wa_broadcast_tick: Task = async (payload, helpers) => {
  const { broadcastId } = payload as { broadcastId: number };

  const res = await sendBroadcastNextBatch(broadcastId);
  logEvent("queue.wa_broadcast_tick", { broadcastId, ...res });

  // Finished, cancelled, failed, or not-yet-due-but-rescheduled-elsewhere.
  if (res.status !== "SENDING" && res.status !== "QUEUED") return;
  if (res.remaining === 0) return;

  // Still draining (or not due yet): re-enqueue. If the broadcast is QUEUED
  // with a future scheduledAt, sendBroadcastNextBatch returned without sending;
  // pace the retry to that time so we don't spin until it's due.
  await helpers.addJob(
    "send_wa_broadcast_tick",
    { broadcastId },
    {
      runAt: new Date(Date.now() + RE_ENQUEUE_GAP_MS),
      jobKey: waBroadcastJobKey(broadcastId),
      jobKeyMode: "replace",
    }
  );
};
