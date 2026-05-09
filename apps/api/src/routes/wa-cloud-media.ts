import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser } from "../auth";
import { logWarn } from "../lib/logger";
import { downloadMediaUrl } from "../modules/wa-cloud/graph-client";

export const waCloudMediaRoutes = new Hono();

/**
 * Proxy media binaries (image / sticker / video / audio / document) for WA
 * Cloud messages. The Meta media URLs are short-lived (~5 min) and require
 * the system user token, so we cannot link them directly from the browser.
 *
 * This route: validates the user session, looks up the message + payload,
 * extracts the Meta media id, fetches the temporary download URL, then
 * streams the binary back with the original Content-Type.
 */
waCloudMediaRoutes.get("/:messageId", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);

  const messageIdRaw = c.req.param("messageId");
  const messageId = Number.parseInt(messageIdRaw, 10);
  if (!Number.isFinite(messageId)) return c.text("Bad message id", 400);

  const message = await db.waMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      type: true,
      mediaMimeType: true,
      payload: true,
      phoneNumber: { select: { accountId: true } },
    },
  });
  if (!message) return c.text("Not found", 404);

  // Pull the Meta media id from the stored webhook payload. Each message type
  // nests the id at a different key (image.id, sticker.id, etc).
  const payload = (message.payload ?? {}) as Record<string, unknown>;
  const lookupKeys = ["image", "sticker", "video", "audio", "document"];
  let mediaId: string | undefined;
  for (const k of lookupKeys) {
    const obj = payload[k] as { id?: string } | undefined;
    if (obj?.id) {
      mediaId = obj.id;
      break;
    }
  }
  if (!mediaId) return c.text("No media id on this message", 404);

  try {
    const meta = await downloadMediaUrl(mediaId, message.phoneNumber.accountId);
    const account = await db.waBusinessAccount.findUnique({
      where: { id: message.phoneNumber.accountId },
      select: { systemUserToken: true },
    });
    if (!account?.systemUserToken) return c.text("Account token missing", 500);

    const upstream = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${account.systemUserToken}` },
    });
    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => "");
      logWarn("[wa-cloud.media] upstream fetch failed", {
        messageId,
        status: upstream.status,
        body: body.slice(0, 200),
      });
      return c.text("Upstream error", 502);
    }

    const contentType =
      upstream.headers.get("content-type") ?? meta.mime_type ?? message.mediaMimeType ?? "application/octet-stream";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 5 min cache: matches Meta URL TTL, avoids re-fetching on scroll-back
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.media] proxy failed", { messageId, error: msg });
    return c.text(`Media proxy error: ${msg}`, 500);
  }
});
