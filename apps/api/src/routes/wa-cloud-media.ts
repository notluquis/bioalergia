import { db } from "@finanzas/db";
import { type Context, Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logWarn } from "../lib/logger.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import {
  downloadMediaUrl,
  updateBusinessProfile,
  uploadMedia,
  uploadProfilePictureHandle,
} from "../modules/wa-cloud/graph-client.ts";

export const waCloudMediaRoutes = new Hono();

// Centralized auth check for any operation tied to a phoneNumberId. Verifies
// the session user holds the requested action on WaBusinessAccount.
async function requireWaPhone(
  c: Context,
  phoneNumberId: number,
  action: "read" | "create" | "update" | "delete",
) {
  const session = await getSessionUser(c);
  if (!session) return { ok: false as const, status: 401 as const, msg: "Unauthorized" };
  const ok = await hasPermission(session, action, "WaBusinessAccount");
  if (!ok) return { ok: false as const, status: 403 as const, msg: "Forbidden" };
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: { id: true, accountId: true },
  });
  if (!phone) return { ok: false as const, status: 404 as const, msg: "Phone not found" };
  return { ok: true as const, session, phone };
}

waCloudMediaRoutes.get("/conversations/:id/export", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }
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
  const form = await c.req.formData();
  const file = form.get("file");
  const phoneNumberIdRaw = form.get("phoneNumberId");
  if (!(file instanceof Blob)) return c.text("Missing file", 400);
  const phoneNumberId = Number.parseInt(String(phoneNumberIdRaw ?? ""), 10);
  if (!Number.isFinite(phoneNumberId)) return c.text("Missing phoneNumberId", 400);
  const auth = await requireWaPhone(c, phoneNumberId, "update");
  if (!auth.ok) return c.text(auth.msg, auth.status);
  // WhatsApp profile picture: square JPEG/PNG, 192x192 to 640x640, max 5MB
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) return c.text("File too large (max 5MB)", 413);
  if (!/^image\/(jpeg|png)$/.test(file.type || "")) {
    return c.text("Only JPEG/PNG allowed", 415);
  }
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

// Resumable upload that returns a Meta media handle (h:...). Used for
// template create's sample header media (image/video/document) so Meta
// can review the visual during template approval. Same upload mechanic
// as the profile-picture handle endpoint, just any phoneNumberId.
waCloudMediaRoutes.post("/template-header-sample", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const phoneNumberIdRaw = form.get("phoneNumberId");
  if (!(file instanceof Blob)) return c.text("Missing file", 400);
  const phoneNumberId = Number.parseInt(String(phoneNumberIdRaw ?? ""), 10);
  if (!Number.isFinite(phoneNumberId)) return c.text("Missing phoneNumberId", 400);
  const auth = await requireWaPhone(c, phoneNumberId, "create");
  if (!auth.ok) return c.text(auth.msg, auth.status);
  const filename = (file as File).name ?? "header-sample";
  // Meta limits: image 5MB, video 16MB, document 100MB.
  const MAX = 100 * 1024 * 1024;
  if (file.size > MAX) return c.text("File too large", 413);
  try {
    const handle = await uploadProfilePictureHandle(phoneNumberId, file, filename);
    return c.json({ handle, filename, size: file.size, mimeType: file.type || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.template-header-sample] upload failed", { error: msg });
    return c.text(msg, 502);
  }
});

waCloudMediaRoutes.post("/upload", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const phoneNumberIdRaw = form.get("phoneNumberId");
  if (!(file instanceof Blob)) return c.text("Missing file", 400);
  const phoneNumberId = Number.parseInt(String(phoneNumberIdRaw ?? ""), 10);
  if (!Number.isFinite(phoneNumberId)) return c.text("Missing phoneNumberId", 400);
  const auth = await requireWaPhone(c, phoneNumberId, "create");
  if (!auth.ok) return c.text(auth.msg, auth.status);
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
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }

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
    const accToken = decryptSecret(account?.systemUserToken);
    if (!accToken) return c.text("Account token missing", 500);

    const upstream = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accToken}` },
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

    const filename = (message as unknown as { mediaCaption?: string | null }).mediaCaption ?? `wa-${messageId}`;
    // Pick the best MIME: prefer upstream → meta → stored → infer from filename.
    let contentType =
      upstream.headers.get("content-type") ?? meta.mime_type ?? message.mediaMimeType ?? "application/octet-stream";
    // Meta sometimes serves PDFs as application/octet-stream — browsers refuse
    // to render those in <iframe>. Override based on extension when needed.
    const lowerName = filename.toLowerCase();
    if (contentType === "application/octet-stream" || contentType === "binary/octet-stream") {
      if (lowerName.endsWith(".pdf")) contentType = "application/pdf";
      else if (lowerName.endsWith(".png")) contentType = "image/png";
      else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
        contentType = "image/jpeg";
      else if (lowerName.endsWith(".webp")) contentType = "image/webp";
      else if (lowerName.endsWith(".mp4")) contentType = "video/mp4";
      else if (lowerName.endsWith(".webm")) contentType = "video/webm";
      else if (lowerName.endsWith(".ogg")) contentType = "audio/ogg";
      else if (lowerName.endsWith(".mp3")) contentType = "audio/mpeg";
    }
    const wantsDownload = c.req.query("download") === "1";
    // Strip quote and any control char from caption-derived filename to
    // prevent header injection. RFC 6266 also lets us drop CR/LF.
    const safeFilename = filename.replace(/[\x00-\x1f\x7f"\\]/g, "_").slice(0, 200);
    const disposition = wantsDownload
      ? `attachment; filename="${safeFilename}"`
      : `inline; filename="${safeFilename}"`;
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        // Allow same-origin iframe embedding for the PDF viewer modal.
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.media] proxy failed", { messageId, error: msg });
    return c.text(`Media proxy error: ${msg}`, 500);
  }
});
