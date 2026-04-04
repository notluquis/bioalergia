/**
 * Baileys WhatsApp WebSocket singleton.
 * Manages the connection lifecycle, QR authentication, event routing,
 * reconnection with backoff, and exposes sending functions.
 *
 * Auth state is persisted in PostgreSQL via `usePostgresAuthState`.
 */
import { db } from "@finanzas/db";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WAMessageStatus,
  type WAMessage,
  type WAMessageKey,
  type WASocket,
} from "baileys";
import qrcode from "qrcode";
import { logError, logEvent, logWarn } from "../logger";
import { usePostgresAuthState } from "./baileys-auth-state";
import {
  recordInboundWhatsappCall,
  recordInboundWhatsappMessage,
} from "./conversation-state";
import { jidToPhone, phoneToJid } from "./jid";

// ---------------------------------------------------------------------------
// Module state (singleton)
// ---------------------------------------------------------------------------

let sock: WASocket | null = null;
let connectionState: "close" | "connecting" | "open" = "close";
let currentQrDataUrl: string | null = null;
let lastDisconnectReason: number | null = null;
let reconnectAttempts = 0;
let saveCreds: (() => Promise<void>) | null = null;

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 2_000;

// ---------------------------------------------------------------------------
// Public API — lifecycle
// ---------------------------------------------------------------------------

export async function initBaileysSocket(): Promise<void> {
  let authState: Awaited<ReturnType<typeof usePostgresAuthState>>;
  try {
    authState = await usePostgresAuthState();
  } catch (err) {
    logError("baileys.auth_state_error", err, {
      hint: "¿Se aplicó la migración baileys_auth_creds / baileys_auth_keys?",
    });
    throw err;
  }

  saveCreds = authState.saveCreds;
  connectionState = "connecting";
  currentQrDataUrl = null;

  sock = makeWASocket({
    auth: {
      creds: authState.state.creds,
      keys: makeCacheableSignalKeyStore(authState.state.keys, undefined),
    },
    browser: ["Bioalergia", "Server", "1.0"],
    markOnlineOnConnect: false,
    printQRInTerminal: process.env.NODE_ENV !== "production",
    getMessage: async (_key) => {
      // Required by Baileys for message retry/resend.
      // We don't persist raw messages, so retries will fail silently.
      return undefined;
    },
  });

  registerEventHandlers(sock, authState.saveCreds);

  logEvent("baileys.init", {});
}

export function getSocket(): WASocket {
  if (!sock) {
    throw new Error("Baileys socket not initialized. Call initBaileysSocket() first.");
  }
  return sock;
}

export function getConnectionStatus() {
  return {
    connectionState,
    lastDisconnectReason,
    qrDataUrl: currentQrDataUrl,
  };
}

export async function disconnectBaileys(): Promise<void> {
  if (sock) {
    sock.end(undefined);
    sock = null;
    connectionState = "close";
    currentQrDataUrl = null;
  }
}

// ---------------------------------------------------------------------------
// Public API — sending
// ---------------------------------------------------------------------------

export interface SendResult {
  messageId: string;
  status: "sent";
}

export async function sendText(
  phone: string,
  body: string,
  options?: { quotedMessage?: WAMessage },
): Promise<SendResult> {
  const s = getSocket();
  const jid = phoneToJid(phone);
  const result = await s.sendMessage(
    jid,
    { text: body },
    options?.quotedMessage ? { quoted: options.quotedMessage } : undefined,
  );
  return { messageId: result?.key.id ?? "", status: "sent" };
}

export async function sendMedia(
  phone: string,
  mediaType: "audio" | "document" | "image" | "sticker" | "video",
  payload: { caption?: string; filename?: string; url?: string },
): Promise<SendResult> {
  const s = getSocket();
  const jid = phoneToJid(phone);

  const mediaSource = payload.url ? { url: payload.url } : undefined;
  if (!mediaSource) {
    throw new Error(`WhatsApp ${mediaType} requiere una URL`);
  }

  let content: Record<string, unknown>;
  switch (mediaType) {
    case "image":
      content = { image: mediaSource, caption: payload.caption };
      break;
    case "video":
      content = { video: mediaSource, caption: payload.caption };
      break;
    case "audio":
      content = { audio: mediaSource, mimetype: "audio/ogg; codecs=opus" };
      break;
    case "document":
      content = {
        document: mediaSource,
        fileName: payload.filename ?? "document",
        mimetype: "application/octet-stream",
        caption: payload.caption,
      };
      break;
    case "sticker":
      content = { sticker: mediaSource };
      break;
    default:
      throw new Error(`Tipo de media no soportado: ${mediaType as string}`);
  }

  const result = await s.sendMessage(jid, content as Parameters<WASocket["sendMessage"]>[1]);
  return { messageId: result?.key.id ?? "", status: "sent" };
}

export async function sendReaction(
  phone: string,
  targetMessageId: string,
  emoji: string,
): Promise<SendResult> {
  const s = getSocket();
  const jid = phoneToJid(phone);
  const key: WAMessageKey = {
    id: targetMessageId,
    remoteJid: jid,
  };
  const result = await s.sendMessage(jid, { react: { text: emoji, key } });
  return { messageId: result?.key.id ?? "", status: "sent" };
}

export async function markAsRead(messageKeys: WAMessageKey[]): Promise<void> {
  const s = getSocket();
  await s.readMessages(messageKeys);
}

export async function sendTyping(phone: string): Promise<void> {
  const s = getSocket();
  const jid = phoneToJid(phone);
  await s.sendPresenceUpdate("composing", jid);
}

// ---------------------------------------------------------------------------
// Event handlers (private)
// ---------------------------------------------------------------------------

function registerEventHandlers(socket: WASocket, saveCredsFn: () => Promise<void>) {
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        currentQrDataUrl = await qrcode.toDataURL(qr);
        logEvent("baileys.qr_generated", {});
      } catch (err) {
        logError("baileys.qr_error", err, {});
      }
    }

    if (connection === "open") {
      connectionState = "open";
      currentQrDataUrl = null;
      lastDisconnectReason = null;
      reconnectAttempts = 0;
      logEvent("baileys.connected", {});
    }

    if (connection === "close") {
      connectionState = "close";
      currentQrDataUrl = null;

      const statusCode =
        (lastDisconnect?.error as Boom)?.output?.statusCode ?? 500;
      lastDisconnectReason = statusCode;

      logWarn("baileys.disconnected", { reason: statusCode });

      if (statusCode === DisconnectReason.loggedOut) {
        logWarn("baileys.logged_out", {
          message: "Session logged out. Delete auth dir and re-scan QR.",
        });
        sock = null;
        return;
      }

      // After QR scan, WhatsApp forcibly disconnects with restartRequired.
      // This is expected — reconnect immediately without backoff.
      if (statusCode === DisconnectReason.restartRequired) {
        logEvent("baileys.restart_required", {});
        initBaileysSocket().catch((err) =>
          logError("baileys.reconnect_error", err, {}),
        );
        return;
      }

      // Reconnect with exponential backoff for other disconnect reasons
      reconnectAttempts++;
      const delay = Math.min(
        BASE_BACKOFF_MS * 2 ** (reconnectAttempts - 1),
        MAX_BACKOFF_MS,
      );
      logEvent("baileys.reconnecting", { attempt: reconnectAttempts, delayMs: delay });
      setTimeout(() => {
        initBaileysSocket().catch((err) =>
          logError("baileys.reconnect_error", err, { attempt: reconnectAttempts }),
        );
      }, delay);
    }
  });

  socket.ev.on("creds.update", saveCredsFn);

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.key.remoteJid || msg.key.fromMe) continue;

      const phone = jidToPhone(msg.key.remoteJid);
      const textBody =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        null;
      const timestamp = msg.messageTimestamp
        ? String(msg.messageTimestamp)
        : null;

      try {
        await recordInboundWhatsappMessage({
          from: phone,
          messageId: msg.key.id ?? "",
          text: textBody,
          timestamp,
          waId: msg.key.remoteJid.split("@")[0],
        });

        logEvent("baileys.inbound_message", {
          messageId: msg.key.id,
          phone,
          type: msg.message ? Object.keys(msg.message)[0] : "unknown",
        });
      } catch (err) {
        logError("baileys.inbound_record_error", err, {
          messageId: msg.key.id,
          phone,
        });
      }
    }
  });

  socket.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (!key.id || update.status == null) continue;

      const now = new Date();
      let dbStatus: string | null = null;
      let extraFields: Record<string, unknown> = {};

      switch (update.status) {
        case WAMessageStatus.SERVER_ACK:
          dbStatus = "SENT";
          break;
        case WAMessageStatus.DELIVERY_ACK:
          dbStatus = "DELIVERED";
          extraFields = { deliveredAt: now };
          break;
        case WAMessageStatus.READ:
          dbStatus = "READ";
          extraFields = { readAt: now };
          break;
        case WAMessageStatus.PLAYED:
          dbStatus = "PLAYED";
          extraFields = { playedAt: now };
          break;
        default:
          continue;
      }

      try {
        await db.$qb
          .updateTable("WhatsappNotification")
          .set({ ...extraFields, status: dbStatus, updatedAt: now })
          .where("waMessageId", "=", key.id)
          .execute();
      } catch {
        // Notification may not exist (e.g. manual messages not tracked in DB)
      }
    }
  });

  socket.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status !== "offer" || !call.from) continue;

      const phone = jidToPhone(call.from);
      try {
        await recordInboundWhatsappCall({
          callId: call.id ?? null,
          from: phone,
          waId: call.from.split("@")[0],
        });

        logEvent("baileys.inbound_call", { callId: call.id, phone });
      } catch (err) {
        logError("baileys.call_record_error", err, {
          callId: call.id,
          phone,
        });
      }
    }
  });
}
