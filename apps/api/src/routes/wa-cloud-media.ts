import { type Context, Hono } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logWarn } from "../lib/logger.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import { getR2Object, putR2Object } from "../modules/cloudflare/r2.ts";
import {
  downloadMediaUrl,
  updateBusinessProfile,
  uploadMedia,
  uploadProfilePictureHandle,
} from "../modules/wa-cloud/graph-client.ts";
import { getWaBusinessAccountForMedia, getWaPhoneNumberForAuth } from "../services/wa-accounts.ts";
import { getWaConversationForExport } from "../services/wa-conversations.ts";
import { getWaMessageForMedia, getWaMessagesForExport } from "../services/wa-messages.ts";
import { getWaSavedStickerForMedia } from "../services/wa-stickers.ts";

export const waCloudMediaRoutes = new Hono();

// Centralized auth check for any operation tied to a phoneNumberId. Verifies
// the session user holds the requested action on WaBusinessAccount.
async function requireWaPhone(
  c: Context,
  phoneNumberId: number,
  action: "read" | "create" | "update" | "delete"
) {
  const session = await getSessionUser(c);
  if (!session) return { ok: false as const, status: 401 as const, msg: "Unauthorized" };
  const ok = await hasPermission(session, action, "WaBusinessAccount");
  if (!ok) return { ok: false as const, status: 403 as const, msg: "Forbidden" };
  const phone = await getWaPhoneNumberForAuth(phoneNumberId);
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
  const conv = await getWaConversationForExport(id);
  if (!conv) return c.text("Not found", 404);
  const messages = await getWaMessagesForExport(id);
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
      }
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
      m.type === "TEXT" ? (m.body ?? "") : `[${m.type.toLowerCase()}]${m.body ? " " + m.body : ""}`;
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
  const handle = await uploadProfilePictureHandle(phoneNumberId, file, filename);
  await updateBusinessProfile(phoneNumberId, { profile_picture_handle: handle });
  return c.json({ ok: true, handle });
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
  const handle = await uploadProfilePictureHandle(phoneNumberId, file, filename);
  return c.json({ handle, filename, size: file.size, mimeType: file.type || null });
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
  const result = await uploadMedia(phoneNumberId, file, mimeType, filename);
  return c.json({ id: result.id, mimeType, filename, size: file.size });
});

/**
 * Stream a saved sticker (.webp) from R2. Auth-gated like the other media
 * routes (read on WaBusinessAccount). The durable R2 copy is private — we never
 * expose unsigned public R2 URLs — so the picker thumbnails load through here.
 *
 * Registered BEFORE the `/:messageId` catch-all so "saved-sticker" is matched
 * as a static segment, not as a message id.
 */
waCloudMediaRoutes.get("/saved-sticker/:id", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.text("Bad id", 400);

  const sticker = await getWaSavedStickerForMedia(id);
  if (!sticker) return c.text("Not found", 404);

  try {
    const obj = await getR2Object(sticker.r2Key);
    const headers: Record<string, string> = {
      "Content-Type": sticker.mimeType || obj.contentType || "image/webp",
      "X-Content-Type-Options": "nosniff",
      // Content-addressed by sha256 → immutable; safe to cache aggressively.
      "Cache-Control": "private, max-age=86400, immutable",
    };
    if (obj.contentLength != null) headers["Content-Length"] = String(obj.contentLength);
    return new Response(obj.body, { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.saved-sticker] R2 stream failed", { id, error: msg });
    return c.text("Sticker fetch error", 502);
  }
});

/**
 * Proxy + cache OSM map tiles for location-message mini-maps. Privacy: the
 * patient's shared location (PHI) must NOT leak to OpenStreetMap from every
 * operator's browser — so the staff browser hits THIS route, and the server
 * fetches OSM once (with a policy-compliant User-Agent) and caches the tile in
 * R2. Subsequent loads serve from R2; OSM is hit only on a cache miss.
 *
 * Registered BEFORE the `/:messageId` catch-all.
 */
waCloudMediaRoutes.get("/map-tile/:z/:x/:y", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }
  const z = Number.parseInt(c.req.param("z"), 10);
  const x = Number.parseInt(c.req.param("x"), 10);
  const y = Number.parseInt(c.req.param("y"), 10);
  const n = 2 ** z;
  if (
    !Number.isInteger(z) ||
    z < 0 ||
    z > 19 ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= n ||
    y >= n
  ) {
    return c.text("Bad tile coords", 400);
  }

  const key = `wa-map-tiles/${z}/${x}/${y}.png`;
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
    // Tiles are effectively immutable for our purposes; cache hard.
    "Cache-Control": "private, max-age=604800, immutable",
  };

  // Cache hit?
  try {
    const obj = await getR2Object(key);
    if (obj.contentLength != null) headers["Content-Length"] = String(obj.contentLength);
    return new Response(obj.body, { status: 200, headers });
  } catch {
    // miss → fetch from OSM below
  }

  try {
    const res = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: {
        // OSM tile usage policy requires an identifying User-Agent.
        "User-Agent": "BioalergiaInbox/1.0 (+https://bioalergia.cl; soporte@bioalergia.cl)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logWarn("[wa-cloud.map-tile] OSM fetch failed", { z, x, y, status: res.status });
      return c.text("Tile fetch error", 502);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    await putR2Object(key, bytes, "image/png").catch((err) => {
      // Cache write is best-effort; still serve the tile this time.
      logWarn("[wa-cloud.map-tile] R2 cache write failed", {
        z,
        x,
        y,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    headers["Content-Length"] = String(bytes.byteLength);
    return new Response(bytes, { status: 200, headers });
  } catch (err) {
    logWarn("[wa-cloud.map-tile] proxy failed", {
      z,
      x,
      y,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.text("Tile error", 502);
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

  const message = await getWaMessageForMedia(messageId);
  if (!message) return c.text("Not found", 404);

  // R2-first: serve the durable copy if the persist job already stored it. Meta
  // media expires, so this is the only path that works for old messages. Falls
  // through to live-proxy on R2 miss (not yet persisted / runner disabled).
  if (message.mediaR2Key) {
    try {
      // Forward the browser's Range header so audio/video can seek and the
      // opus voice-note duration probe resolves (without this the player
      // hangs on a spinner: no Content-Length, no ranges → duration unknown).
      const rangeHeader = c.req.header("range");
      const obj = await getR2Object(message.mediaR2Key, rangeHeader);
      const ct = (message.mediaMimeType ?? obj.contentType ?? "application/octet-stream").toLowerCase();
      const inlineSafe =
        ct === "application/pdf" ||
        (ct.startsWith("image/") && ct !== "image/svg+xml") ||
        ct.startsWith("video/") ||
        ct.startsWith("audio/");
      const wantsDownload = c.req.query("download") === "1";
      const fname = `wa-${messageId}`;
      const isPartial = Boolean(rangeHeader && obj.contentRange);
      const headers: Record<string, string> = {
        "Content-Type": message.mediaMimeType ?? obj.contentType,
        "Content-Disposition":
          wantsDownload || !inlineSafe
            ? `attachment; filename="${fname}"`
            : `inline; filename="${fname}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "private, max-age=300",
        "Accept-Ranges": "bytes",
      };
      if (obj.contentLength != null) headers["Content-Length"] = String(obj.contentLength);
      if (isPartial && obj.contentRange) headers["Content-Range"] = obj.contentRange;
      return new Response(obj.body, { status: isPartial ? 206 : 200, headers });
    } catch (err) {
      logWarn("[wa-cloud.media] r2 miss, falling back to live-proxy", {
        messageId,
        r2Key: message.mediaR2Key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

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
    const accountId = message.phoneNumber.accountId;
    const account = await getWaBusinessAccountForMedia(accountId);
    const accToken = decryptSecret(account?.systemUserToken);
    if (!accToken) return c.text("Account token missing", 500);

    // Forward the browser Range header to Meta's CDN (it supports ranges) so
    // audio/video can seek and opus duration resolves on not-yet-persisted
    // media (e.g. a just-forwarded voice note before its R2 copy exists).
    const rangeHeader = c.req.header("range");
    const upstream = await fetch(meta.url, {
      headers: {
        Authorization: `Bearer ${accToken}`,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });
    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => "");
      const isExpired = body.includes("does not exist") || body.includes("GraphMethodException");
      logWarn("[wa-cloud.media] upstream fetch failed", {
        messageId,
        status: upstream.status,
        expired: isExpired,
        body: body.slice(0, 200),
      });
      return c.text(isExpired ? "Media expired" : "Upstream error", isExpired ? 410 : 502);
    }

    const filename =
      (message as unknown as { mediaCaption?: string | null }).mediaCaption ?? `wa-${messageId}`;
    // Pick the best MIME: prefer upstream → meta → stored → infer from filename.
    let contentType =
      upstream.headers.get("content-type") ??
      meta.mime_type ??
      message.mediaMimeType ??
      "application/octet-stream";
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
    // Only render trusted media types inline. The content-type comes from an
    // untrusted contact (upstream/Meta); text/html or image/svg+xml served
    // inline same-origin is a stored-XSS / defacement surface. Force download
    // for anything outside the safe render allowlist.
    const ct = contentType.toLowerCase();
    const inlineSafe =
      ct === "application/pdf" ||
      (ct.startsWith("image/") && ct !== "image/svg+xml") ||
      ct.startsWith("video/") ||
      ct.startsWith("audio/");
    const disposition =
      wantsDownload || !inlineSafe
        ? `attachment; filename="${safeFilename}"`
        : `inline; filename="${safeFilename}"`;
    // Relay Meta's range response so the browser gets the same seek semantics
    // as the R2 path (206 + Content-Range when partial, else 200).
    const upstreamRange = upstream.headers.get("content-range");
    const upstreamLen = upstream.headers.get("content-length");
    const isPartial = upstream.status === 206 && Boolean(upstreamRange);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      // Don't let the browser MIME-sniff around the declared content-type.
      "X-Content-Type-Options": "nosniff",
      // Allow same-origin iframe embedding for the PDF viewer modal.
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "private, max-age=300",
      "Accept-Ranges": "bytes",
    };
    if (upstreamLen) headers["Content-Length"] = upstreamLen;
    if (isPartial && upstreamRange) headers["Content-Range"] = upstreamRange;
    return new Response(upstream.body, { status: isPartial ? 206 : 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isExpired = msg.includes("does not exist") || msg.includes("GraphMethodException");
    logWarn("[wa-cloud.media] proxy failed", { messageId, expired: isExpired, error: msg });
    return c.text(isExpired ? "Media expired" : `Media proxy error: ${msg}`, isExpired ? 410 : 500);
  }
});
