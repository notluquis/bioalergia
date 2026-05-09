import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser } from "../auth.ts";
import { logWarn } from "../lib/logger.ts";
import {
  downloadMediaUrl,
  updateBusinessProfile,
  uploadMedia,
  uploadProfilePictureHandle,
} from "../modules/wa-cloud/graph-client.ts";

export const waCloudMediaRoutes = new Hono();

waCloudMediaRoutes.get("/conversations/:id/export", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.text("Bad id", 400);
  const format = (c.req.query("format") ?? "txt").toLowerCase();
  const conv = await db.waConversation.findUnique({
    where: { id },
    include: { contact: true },
  });
  if (!conv) return c.text("Not found", 404);
  const messages = await db.waMessage.findMany({
    where: { conversationId: id },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      timestamp: true,
      direction: true,
      type: true,
      body: true,
      status: true,
      metaMessageId: true,
    },
  });
  const contactName = conv.contact.name ?? conv.contact.pushName ?? conv.contact.phoneE164;
  if (format === "json") {
    return c.json(
      {
        contact: { name: contactName, phoneE164: conv.contact.phoneE164 },
        exportedAt: new Date().toISOString(),
        messages,
      },
      200,
      {
        "Content-Disposition": `attachment; filename="wa-${conv.contact.phoneE164}-${id}.json"`,
      },
    );
  }
  const lines: string[] = [
    `Conversación WhatsApp · ${contactName} (${conv.contact.phoneE164})`,
    `Exportado: ${new Date().toISOString()}`,
    `Mensajes: ${messages.length}`,
    "─".repeat(60),
    "",
  ];
  for (const m of messages) {
    const ts = m.timestamp.toISOString().replace("T", " ").slice(0, 19);
    const who = m.direction === "OUTBOUND" ? "Yo" : contactName;
    const body =
      m.type === "TEXT"
        ? (m.body ?? "")
        : `[${m.type.toLowerCase()}]${m.body ? " " + m.body : ""}`;
    lines.push(`[${ts}] ${who}: ${body}`);
  }
  return c.text(lines.join("\n"), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="wa-${conv.contact.phoneE164}-${id}.txt"`,
  });
});

/**
 * Multipart upload from intranet → Meta media endpoint. Returns the Meta
 * media id which the frontend then passes to the sendMedia ORPC route.
 *
 * Body: multipart/form-data with `file` and optional `phoneNumberId` (form
 * field). Auth: PASETO session.
 */
waCloudMediaRoutes.post("/profile-picture", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  const form = await c.req.formData();
  const file = form.get("file");
  const phoneNumberIdRaw = form.get("phoneNumberId");
  if (!(file instanceof Blob)) return c.text("Missing file", 400);
  const phoneNumberId = Number.parseInt(String(phoneNumberIdRaw ?? ""), 10);
  if (!Number.isFinite(phoneNumberId)) return c.text("Missing phoneNumberId", 400);
  // WhatsApp profile picture: square JPEG/PNG, 192x192 to 640x640, max 5MB
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) return c.text("File too large (max 5MB)", 413);
  const filename = (file as File).name ?? "avatar.jpg";
  try {
    const handle = await uploadProfilePictureHandle(phoneNumberId, file, filename);
    await updateBusinessProfile(phoneNumberId, { profile_picture_handle: handle });
    return c.json({ ok: true, handle });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.profile-picture] upload failed", { error: msg });
    return c.text(msg, 502);
  }
});

waCloudMediaRoutes.post("/upload", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  const form = await c.req.formData();
  const file = form.get("file");
  const phoneNumberIdRaw = form.get("phoneNumberId");
  if (!(file instanceof Blob)) return c.text("Missing file", 400);
  const phoneNumberId = Number.parseInt(String(phoneNumberIdRaw ?? ""), 10);
  if (!Number.isFinite(phoneNumberId)) return c.text("Missing phoneNumberId", 400);
  const filename = (file as File).name ?? "upload";
  const mimeType = file.type || "application/octet-stream";
  // Meta size limits per type (image 5MB, document 100MB, video 16MB, audio 16MB).
  const MAX = 100 * 1024 * 1024;
  if (file.size > MAX) return c.text("File too large", 413);
  try {
    const result = await uploadMedia(phoneNumberId, file, mimeType, filename);
    return c.json({ id: result.id, mimeType, filename, size: file.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.media] upload failed", { error: msg });
    return c.text(msg, 502);
  }
});

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
