// graphile-worker task: send one scheduled WhatsApp message at its due time.
//
// Enqueued by the scheduleMessage handler (jobKey `wa_scheduled_<id>`, replace,
// runAt = scheduledAt). One-shot — no re-enqueue. All send/persist logic lives
// in the service; this is a thin adapter.

import type { Task } from "graphile-worker";
import { z } from "zod";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { sendScheduledMessage } from "../../services/wa-scheduled.ts";

// Validate the untrusted graphile-worker payload before use (DB-persisted JSON).
const sendWaScheduledPayload = z.object({ scheduledMessageId: z.number().int().positive() });

export const send_wa_scheduled: Task = async (payload) => {
  const parsed = sendWaScheduledPayload.safeParse(payload);
  if (!parsed.success) {
    logWarn("queue.wa_scheduled_tick.invalid_payload", { error: parsed.error.message });
    return;
  }
  const { scheduledMessageId } = parsed.data;
  const res = await sendScheduledMessage(scheduledMessageId);
  logEvent("queue.wa_scheduled_tick", { scheduledMessageId, ...res });
};

export function waScheduledJobKey(scheduledMessageId: number): string {
  return `wa_scheduled_${scheduledMessageId}`;
}
