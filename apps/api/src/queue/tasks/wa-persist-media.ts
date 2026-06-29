// graphile-worker task: persist one inbound WhatsApp media message to R2.
//
// Enqueued by the webhook handler (jobKey `wa_media_<id>`, replace) when an
// inbound media message is stored. One-shot; graphile retries on failure. Thin
// adapter — all logic lives in the service.

import type { Task } from "graphile-worker";
import { z } from "zod";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { persistMessageMedia } from "../../services/wa-message-media.ts";

const payloadSchema = z.object({ messageId: z.number().int().positive() });

export const wa_persist_media: Task = async (payload) => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    logWarn("queue.wa_persist_media.invalid_payload", { error: parsed.error.message });
    return;
  }
  const { messageId } = parsed.data;
  const result = await persistMessageMedia(messageId);
  logEvent("queue.wa_persist_media", { messageId, result });
};

export function waPersistMediaJobKey(messageId: number): string {
  return `wa_media_${messageId}`;
}
