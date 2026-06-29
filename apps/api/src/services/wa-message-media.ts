// Persist inbound WhatsApp media to R2 (durable copy).
//
// Meta media ids/URLs are ephemeral (download URL ~5 min, media itself deleted
// after a while), so the live-proxy loses old media. Per Meta's guidance we
// download on receipt and store our own copy. Enqueued as a graphile-worker
// job from the webhook handler (jobKey per message), so the webhook stays fast
// and the download retries on transient failure. The job runs near-instantly
// (LISTEN/NOTIFY) and downloadMediaBytes re-fetches a fresh URL, so the 5-min
// window is never an issue.

import { db } from "@finanzas/db";
import { logEvent } from "../lib/logger.ts";
import { downloadMediaBytes, downloadMediaUrl } from "../modules/wa-cloud/graph-client.ts";
import { putR2Object } from "../modules/cloudflare/r2.ts";

// ponytail: 25MB cap — downloadMediaBytes buffers the whole file in memory and
// the api heap is 1GB; Meta inbound docs go up to 100MB, which × concurrent
// jobs would OOM. Over-cap media stays on live-proxy (works while fresh).
// Raise this only if persist switches to streaming R2 upload.
const MAX_PERSIST_BYTES = 25 * 1024 * 1024;

const MEDIA_KEYS = ["image", "sticker", "video", "audio", "document"] as const;

function mediaIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const k of MEDIA_KEYS) {
    const node = obj[k] as { id?: string } | undefined;
    if (node?.id) return node.id;
  }
  return null;
}

export async function persistInboundMedia(
  messageId: number
): Promise<"persisted" | "skipped" | "no_media"> {
  const message = await db.waMessage.findUnique({
    where: { id: messageId },
    include: { phoneNumber: { select: { accountId: true } } },
  });
  if (!message) return "skipped";
  if (message.mediaR2Key) return "skipped"; // already persisted (idempotent)

  const mediaId = mediaIdFromPayload(message.payload);
  if (!mediaId) return "no_media";

  const accountId = message.phoneNumber.accountId;
  // Cheap metadata GET first → skip oversized media before buffering it.
  const info = await downloadMediaUrl(mediaId, accountId);
  if (info.file_size > MAX_PERSIST_BYTES) {
    logEvent("wa.media.skip_too_large", { messageId, fileSize: info.file_size });
    return "skipped";
  }
  const { bytes, mimeType } = await downloadMediaBytes(mediaId, accountId);
  const r2Key = `wa-media/${accountId}/${messageId}`;
  await putR2Object(r2Key, bytes, mimeType || message.mediaMimeType || "application/octet-stream");

  await db.waMessage.update({
    where: { id: messageId },
    data: { mediaR2Key: r2Key, mediaMimeType: message.mediaMimeType ?? mimeType },
  });
  logEvent("wa.media.persisted", { messageId, accountId, r2Key, bytes: bytes.length });
  return "persisted";
}
