/**
 * Baileys WhatsApp WebSocket singleton.
 * Manages connection lifecycle, QR authentication, history persistence,
 * reconnection with backoff, and send helpers used by the settings panel.
 */
import { db } from "@finanzas/db";
import { Boom } from "@hapi/boom";
import { createId } from "@paralleldrive/cuid2";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type Contact,
  type WAMessage,
  type WAMessageKey,
  type WASocket,
} from "baileys";
import qrcode from "qrcode";
import { logError, logEvent, logWarn } from "../logger";
import { clearAuthState, usePostgresAuthState } from "./baileys-auth-state";
import {
  markWhatsappBusinessQuickReplyDeleted,
  removeWhatsappBusinessChatLabel,
  removeWhatsappBusinessMessageLabel,
  upsertWhatsappBusinessChatLabel,
  upsertWhatsappBusinessLabel,
  upsertWhatsappBusinessMessageLabel,
  upsertWhatsappBusinessQuickReply,
} from "./business-store";
import {
  recordInboundWhatsappCall,
  recordInboundWhatsappMessage,
} from "./conversation-state";
import {
  applyWhatsappMessageUpdate,
  getWhatsappMessageContent,
  getWhatsappQuotedMessage,
  persistWhatsappHistorySet,
  upsertWhatsappChats,
  upsertWhatsappContacts,
  upsertWhatsappMessage,
} from "./history-store";
import { isWhatsappUserJid, jidToPhone, normalizePhone, phoneToJid } from "./jid";

let sock: WASocket | null = null;
let connectionState: "close" | "connecting" | "open" = "close";
let currentQrDataUrl: string | null = null;
let lastDisconnectReason: number | null = null;
let reconnectAttempts = 0;
let authClearAttempts = 0;
let receivedPendingNotifications = false;
let sessionReplaced = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualDisconnect = false;
let connectedAt: Date | null = null;
let lastReconnectDelayMs: number | null = null;
let activeVersion: null | [number, number, number] = null;

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 2_000;
const MAX_AUTH_CLEAR_ATTEMPTS = 3;
const BAILEYS_CLIENT_NAME = "Bioalergia";
const BAILEYS_BROWSER = Browsers.appropriate(BAILEYS_CLIENT_NAME);

async function loadBaileysVersion() {
  if (!activeVersion) {
    const { version } = await fetchLatestBaileysVersion();
    activeVersion = version;
    logEvent("baileys.version", { version });
  }

  return activeVersion;
}

function versionLabel(version: null | [number, number, number]) {
  return version ? version.join(".") : null;
}

function browserLabel() {
  return BAILEYS_BROWSER.join(" / ");
}

function toSendResult(result: WAMessage) {
  return {
    messageId: result?.key.id ?? "",
    status: "sent" as const,
  };
}

async function persistOutboundResult(result: WAMessage) {
  await upsertWhatsappMessage({
    message: result,
    status: "SENT",
  });
}

async function buildQuotedMessage(args: {
  messageId?: string;
  phone?: string;
  remoteJid?: string;
}) {
  if (!args.messageId) return undefined;
  return await getWhatsappQuotedMessage({
    messageId: args.messageId,
    phone: args.phone,
    remoteJid: args.remoteJid,
  });
}

function contactToVcard(contact: {
  displayName: string;
  firstName?: string;
  organization?: string;
  phone: string;
}) {
  const normalizedPhone = normalizePhone(contact.phone);
  const digits = normalizedPhone.replace(/^\+/, "");
  const firstName = contact.firstName ?? contact.displayName;
  const organization = contact.organization ?? "Bioalergia";

  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${contact.displayName}`,
    `N:${firstName};;;;`,
    `ORG:${organization}`,
    `TEL;type=CELL;type=VOICE;waid=${digits}:${normalizedPhone}`,
    "END:VCARD",
  ].join("\n");
}

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

  manualDisconnect = false;
  clearReconnectTimer();
  connectionState = "connecting";
  currentQrDataUrl = null;
  receivedPendingNotifications = false;
  sessionReplaced = false;

  const version = await loadBaileysVersion();

  sock = makeWASocket({
    auth: {
      creds: authState.state.creds,
      keys: makeCacheableSignalKeyStore(authState.state.keys, undefined),
    },
    browser: BAILEYS_BROWSER,
    getMessage: async (key) => await getWhatsappMessageContent(key),
    markOnlineOnConnect: false,
    printQRInTerminal: process.env.NODE_ENV !== "production",
    syncFullHistory: false,
    version,
  });

  registerEventHandlers(sock, authState.saveCreds);
  logEvent("baileys.init", {
    browser: browserLabel(),
    version: versionLabel(version),
  });
}

export function getSocket(): WASocket {
  if (!sock) {
    throw new Error("Baileys socket not initialized. Call initBaileysSocket() first.");
  }

  return sock;
}

export function getConnectionStatus() {
  return {
    browser: browserLabel(),
    connectedAt,
    connectionState,
    isReady: connectionState === "open" && receivedPendingNotifications && !sessionReplaced,
    isReconnectLooping: reconnectAttempts >= 3,
    lastDisconnectReason,
    lastReconnectDelayMs,
    qrDataUrl: currentQrDataUrl,
    receivedPendingNotifications,
    reconnectAttempts,
    sessionReplaced,
    version: versionLabel(activeVersion),
  };
}

export async function disconnectBaileys(): Promise<void> {
  manualDisconnect = true;
  clearReconnectTimer();
  if (sock) {
    sock.end(undefined);
    sock = null;
  }

  connectionState = "close";
  connectedAt = null;
  currentQrDataUrl = null;
  receivedPendingNotifications = false;
  reconnectAttempts = 0;
  authClearAttempts = 0;
  sessionReplaced = false;
  lastReconnectDelayMs = null;
}

export interface SendResult {
  messageId: string;
  status: "sent";
}

export async function sendText(
  phone: string,
  body: string,
  options?: { quotedMessage?: WAMessage },
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);
  const result = await s.sendMessage(
    jid,
    { text: body },
    options?.quotedMessage ? { quoted: options.quotedMessage } : undefined,
  );
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function sendMedia(
  phone: string,
  mediaType: "audio" | "document" | "image" | "sticker" | "video",
  payload: { caption?: string; filename?: string; url?: string },
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);

  const mediaSource = payload.url ? { url: payload.url } : undefined;
  if (!mediaSource) {
    throw new Error(`WhatsApp ${mediaType} requiere una URL`);
  }

  let content: Parameters<WASocket["sendMessage"]>[1];
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
        caption: payload.caption,
        document: mediaSource,
        fileName: payload.filename ?? "document",
        mimetype: "application/octet-stream",
      };
      break;
    case "sticker":
      content = { sticker: mediaSource };
      break;
  }

  const result = await s.sendMessage(jid, content);
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function sendReaction(
  phone: string,
  targetMessageId: string,
  emoji: string,
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);
  const key: WAMessageKey = {
    id: targetMessageId,
    remoteJid: jid,
  };
  const result = await s.sendMessage(jid, { react: { key, text: emoji } });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function sendForward(
  phone: string,
  targetMessageId: string,
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);
  const original = await getWhatsappQuotedMessage({ messageId: targetMessageId, phone });
  if (!original) {
    throw new Error("No se encontró el mensaje a reenviar.");
  }

  const result = await s.sendMessage(jid, { forward: original, force: true });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function deleteMessage(
  phone: string,
  targetMessageId: string,
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);
  const result = await s.sendMessage(jid, {
    delete: {
      id: targetMessageId,
      remoteJid: jid,
    },
  });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function editMessage(
  phone: string,
  targetMessageId: string,
  body: string,
): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(phone);
  const result = await s.sendMessage(jid, {
    edit: {
      id: targetMessageId,
      remoteJid: jid,
    },
    text: body,
  });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function sendLocation(args: {
  address?: string;
  degreesLatitude: number;
  degreesLongitude: number;
  name?: string;
  phone: string;
}): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(args.phone);
  const result = await s.sendMessage(jid, {
    location: {
      address: args.address,
      degreesLatitude: args.degreesLatitude,
      degreesLongitude: args.degreesLongitude,
      name: args.name,
    },
  });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function sendContacts(args: {
  contacts: Array<{
    displayName: string;
    firstName?: string;
    organization?: string;
    phone: string;
  }>;
  phone: string;
}): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(args.phone);
  if (args.contacts.length === 0) {
    throw new Error("Debes enviar al menos un contacto.");
  }

  const result = await s.sendMessage(jid, {
    contacts: {
      contacts: args.contacts.map((contact) => ({
        displayName: contact.displayName,
        vcard: contactToVcard(contact),
      })),
      displayName: args.contacts[0]?.displayName ?? "Contacto",
    },
  });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function setDisappearingMessages(args: {
  expiration: boolean | number;
  phone: string;
}): Promise<SendResult> {
  const s = getReadySocket();
  const jid = phoneToJid(args.phone);
  const result = await s.sendMessage(jid, {
    disappearingMessagesInChat: args.expiration,
  });
  await persistOutboundResult(result);
  return toSendResult(result);
}

export async function markAsRead(messageKeys: WAMessageKey[]): Promise<void> {
  const s = getReadySocket();
  await s.readMessages(messageKeys);
}

export async function sendPresenceState(state: "available" | "composing" | "paused" | "recording" | "unavailable", phone?: string): Promise<void> {
  const s = getReadySocket();
  const jid = phone ? phoneToJid(phone) : undefined;
  await s.sendPresenceUpdate(state, jid);
}

export async function sendTyping(phone: string): Promise<void> {
  await sendPresenceState("composing", phone);
}

export async function getBusinessProfile() {
  const s = getReadySocket();
  const ownJid = s.user?.id;
  if (!ownJid) {
    throw new Error("No se pudo resolver el JID actual del canal.");
  }

  const profile = await s.getBusinessProfile(ownJid);
  if (!profile) {
    return null;
  }

  return {
    address: profile.address,
    businessHours: profile.business_hours
      ? {
          config: (profile.business_hours.business_config ?? profile.business_hours.config ?? []).map(
            (item) => ({
              closeTime: item.close_time,
              dayOfWeek: item.day_of_week,
              mode: item.mode,
              openTime: item.open_time,
            }),
          ),
          timezone: profile.business_hours.timezone,
        }
      : null,
    category: profile.category,
    description: profile.description,
    email: profile.email,
    website: profile.website,
    wid: profile.wid,
  };
}

export async function updateBusinessProfile(args: {
  address?: string;
  description?: string;
  email?: string;
  hours?: {
    days: Array<
      | {
          closeTimeInMinutes: string;
          day: "fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed";
          mode: "specific_hours";
          openTimeInMinutes: string;
        }
      | {
          day: "fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed";
          mode: "appointment_only" | "open_24h";
        }
    >;
    timezone: string;
  };
  websites?: string[];
}) {
  const s = getReadySocket();
  await s.updateBussinesProfile(args);
  return await getBusinessProfile();
}

export async function updateBusinessCoverPhoto(link: string) {
  const s = getReadySocket();
  const coverPhotoId = await s.updateCoverPhoto({ url: link });
  return { coverPhotoId: String(coverPhotoId) };
}

export async function removeBusinessCoverPhoto(coverPhotoId: string) {
  const s = getReadySocket();
  await s.removeCoverPhoto(coverPhotoId);
}

export async function createOrUpdateBusinessQuickReply(input: {
  keywords?: string[];
  message: string;
  shortcut: string;
  timestamp?: string;
}) {
  const s = getReadySocket();
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));

  await s.addOrEditQuickReply({
    count: 0,
    deleted: false,
    keywords: input.keywords ?? [],
    message: input.message,
    shortcut: input.shortcut,
    timestamp,
  });

  return await upsertWhatsappBusinessQuickReply({
    keywords: input.keywords ?? [],
    message: input.message,
    shortcut: input.shortcut,
    timestamp,
  });
}

export async function deleteBusinessQuickReply(timestamp: string) {
  const s = getReadySocket();
  await s.removeQuickReply(timestamp);
  await markWhatsappBusinessQuickReplyDeleted(timestamp);
}

export async function createOrUpdateBusinessLabel(input: {
  color?: number | null;
  deleted?: boolean;
  id?: string;
  name?: string | null;
  predefinedId?: string | null;
}) {
  const s = getReadySocket();
  const id = input.id ?? createId();

  await s.addLabel("", {
    color: input.color ?? undefined,
    deleted: input.deleted ?? false,
    id,
    name: input.name ?? undefined,
    predefinedId:
      input.predefinedId != null && input.predefinedId !== ""
        ? Number(input.predefinedId)
        : undefined,
  });

  return await upsertWhatsappBusinessLabel({
    color: input.color ?? null,
    deleted: input.deleted ?? false,
    id,
    name: input.name ?? null,
    predefinedId: input.predefinedId ?? null,
  });
}

export async function assignBusinessChatLabel(input: { chatJid: string; labelId: string }) {
  const s = getReadySocket();
  await s.addChatLabel(input.chatJid, input.labelId);
  await upsertWhatsappBusinessChatLabel(input);
}

export async function removeBusinessChatLabel(input: { chatJid: string; labelId: string }) {
  const s = getReadySocket();
  await s.removeChatLabel(input.chatJid, input.labelId);
  await removeWhatsappBusinessChatLabel(input);
}

export async function assignBusinessMessageLabel(input: {
  chatJid: string;
  labelId: string;
  messageId: string;
}) {
  const s = getReadySocket();
  await s.addMessageLabel(input.chatJid, input.messageId, input.labelId);
  await upsertWhatsappBusinessMessageLabel(input);
}

export async function removeBusinessMessageLabel(input: {
  chatJid: string;
  labelId: string;
  messageId: string;
}) {
  const s = getReadySocket();
  await s.removeMessageLabel(input.chatJid, input.messageId, input.labelId);
  await removeWhatsappBusinessMessageLabel(input);
}

function registerEventHandlers(socket: WASocket, saveCredsFn: () => Promise<void>) {
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr, receivedPendingNotifications: pending } = update;

    if (connection === "connecting") {
      connectionState = "connecting";
    }

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
      connectedAt = new Date();
      currentQrDataUrl = null;
      lastDisconnectReason = null;
      reconnectAttempts = 0;
      authClearAttempts = 0;
      sessionReplaced = false;
      lastReconnectDelayMs = null;
      clearReconnectTimer();
      logEvent("baileys.connected", {
        browser: browserLabel(),
        version: versionLabel(activeVersion),
      });

      try {
        await socket.sendPresenceUpdate("unavailable");
      } catch (err) {
        logError("baileys.presence_unavailable_error", err, {});
      }
    }

    if (pending) {
      receivedPendingNotifications = true;
      logEvent("baileys.ready", {});
    }

    if (connection === "close") {
      connectionState = "close";
      currentQrDataUrl = null;
      receivedPendingNotifications = false;

      if (manualDisconnect) {
        sock = null;
        lastDisconnectReason = null;
        connectedAt = null;
        logEvent("baileys.disconnected_manually", {});
        return;
      }

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode ?? 500;
      lastDisconnectReason = statusCode;
      logWarn("baileys.disconnected", { reason: statusCode });

      const shouldClearAuthState =
        statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession;

      if (shouldClearAuthState) {
        authClearAttempts++;
        if (authClearAttempts > MAX_AUTH_CLEAR_ATTEMPTS) {
          logWarn("baileys.auth_failure_max_retries", {
            message: "Too many auth failures. Giving up until the connection is re-enabled.",
          });
          sock = null;
          return;
        }

        logWarn("baileys.auth_failure", {
          attempt: authClearAttempts,
          message: "Session invalid. Clearing auth state and waiting for manual restart.",
          reason: statusCode,
        });
        sock = null;
        await clearAuthState();
        return;
      }

      if (statusCode === DisconnectReason.connectionReplaced) {
        sessionReplaced = true;
        sock = null;
        clearReconnectTimer();
        logWarn("baileys.session_replaced", {
          message: "WhatsApp session was replaced by another linked device. Automatic reconnect is paused.",
        });
        return;
      }

      if (
        statusCode === DisconnectReason.multideviceMismatch ||
        statusCode === DisconnectReason.forbidden
      ) {
        sock = null;
        clearReconnectTimer();
        logWarn("baileys.non_recoverable_disconnect", {
          message: "WhatsApp connection stopped due to a non-recoverable disconnect reason.",
          reason: statusCode,
        });
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        logEvent("baileys.restart_required", {});
        scheduleReconnect(0);
        return;
      }

      const shouldReconnect =
        statusCode === DisconnectReason.connectionClosed ||
        statusCode === DisconnectReason.connectionLost ||
        statusCode === DisconnectReason.timedOut ||
        statusCode === DisconnectReason.unavailableService;

      if (!shouldReconnect) {
        sock = null;
        clearReconnectTimer();
        logWarn("baileys.reconnect_skipped", {
          message: "Disconnect reason is not configured for automatic reconnect.",
          reason: statusCode,
        });
        return;
      }

      reconnectAttempts++;
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** (reconnectAttempts - 1), MAX_BACKOFF_MS);
      scheduleReconnect(delay);
    }
  });

  socket.ev.on("creds.update", saveCredsFn);

  socket.ev.on("messaging-history.set", async ({ chats, contacts, messages }) => {
    try {
      await persistWhatsappHistorySet({ chats, contacts, messages });
      logEvent("baileys.history_set", {
        chats: chats.length,
        contacts: contacts.length,
        messages: messages.length,
      });
    } catch (err) {
      logError("baileys.history_set_error", err, {
        chats: chats.length,
        contacts: contacts.length,
        messages: messages.length,
      });
    }
  });

  socket.ev.on("chats.upsert", async (chats) => {
    try {
      await upsertWhatsappChats(chats);
    } catch (err) {
      logError("baileys.chats_upsert_error", err, { count: chats.length });
    }
  });

  socket.ev.on("chats.update", async (updates) => {
    try {
      const upsertableChats = updates
        .filter((chat): chat is typeof chat & { id: string } => Boolean(chat.id))
        .map(
          (chat) =>
            ({
              archive: chat.archive,
              conversationTimestamp: chat.conversationTimestamp,
              id: chat.id,
              muteEndTime: chat.muteEndTime,
              name: chat.name,
              notSpam: chat.notSpam,
              pin: chat.pin,
              unreadCount: chat.unreadCount,
            }) satisfies Parameters<typeof upsertWhatsappChats>[0][number],
        );
      await upsertWhatsappChats(upsertableChats);
    } catch (err) {
      logError("baileys.chats_update_error", err, { count: updates.length });
    }
  });

  socket.ev.on("contacts.upsert", async (contacts) => {
    try {
      await upsertWhatsappContacts(contacts);
    } catch (err) {
      logError("baileys.contacts_upsert_error", err, { count: contacts.length });
    }
  });

  socket.ev.on("contacts.update", async (contacts) => {
    try {
      const upsertableContacts = contacts
        .filter((contact): contact is Partial<Contact> & { id: string } => Boolean(contact.id))
        .map(
          (contact) =>
            ({
              id: contact.id,
              imgUrl: contact.imgUrl,
              name: contact.name,
              notify: contact.notify,
              verifiedName: contact.verifiedName,
            }) satisfies Contact,
        );
      await upsertWhatsappContacts(upsertableContacts);
    } catch (err) {
      logError("baileys.contacts_update_error", err, { count: contacts.length });
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const msg of messages) {
      try {
        await upsertWhatsappMessage({ message: msg });
      } catch (err) {
        logError("baileys.message_persist_error", err, {
          messageId: msg.key.id,
          remoteJid: msg.key.remoteJid,
          upsertType: type,
        });
      }

      if (type !== "notify") continue;
      if (!msg.key.remoteJid || msg.key.fromMe) continue;
      if (!isWhatsappUserJid(msg.key.remoteJid)) continue;

      const phone = jidToPhone(msg.key.remoteJid);
      const textBody =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.imageMessage?.caption ??
        msg.message?.videoMessage?.caption ??
        null;
      const timestamp = msg.messageTimestamp ? String(msg.messageTimestamp) : null;

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
      if (!key.id) continue;

      try {
        await applyWhatsappMessageUpdate(key, update);
      } catch (err) {
        logError("baileys.message_update_persist_error", err, {
          messageId: key.id,
          remoteJid: key.remoteJid,
        });
      }

      if (update.status == null) continue;

      const now = new Date();
      let dbStatus: "DELIVERED" | "PLAYED" | "READ" | "SENT" | null = null;
      let extraFields: Record<string, unknown> = {};

      switch (update.status) {
        case 2:
          dbStatus = "SENT";
          break;
        case 3:
          dbStatus = "DELIVERED";
          extraFields = { deliveredAt: now };
          break;
        case 4:
          dbStatus = "READ";
          extraFields = { readAt: now };
          break;
        case 5:
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
        // Notifications only track Doctoralia automation and some legacy sends.
      }
    }
  });

  socket.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status !== "offer" || !call.from) continue;
      if (!isWhatsappUserJid(call.from)) continue;

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

  socket.ev.on("labels.edit", (label) => {
    void upsertWhatsappBusinessLabel({
      color: label.color ?? null,
      deleted: label.deleted ?? false,
      id: label.id,
      name: label.name ?? null,
      predefinedId: label.predefinedId ?? null,
    }).catch((err) => {
      logError("baileys.labels_edit_sync_error", err, {
        labelId: label.id,
      });
    });
  });

  socket.ev.on("labels.association", (event) => {
    const work =
      event.association.type === "label_jid"
        ? event.type === "add"
          ? upsertWhatsappBusinessChatLabel({
              chatJid: event.association.chatId,
              labelId: event.association.labelId,
            })
          : removeWhatsappBusinessChatLabel({
              chatJid: event.association.chatId,
              labelId: event.association.labelId,
            })
        : event.type === "add"
          ? upsertWhatsappBusinessMessageLabel({
              chatJid: event.association.chatId,
              labelId: event.association.labelId,
              messageId: event.association.messageId,
            })
          : removeWhatsappBusinessMessageLabel({
              chatJid: event.association.chatId,
              labelId: event.association.labelId,
              messageId: event.association.messageId,
            });

    void work.catch((err) => {
      logError("baileys.labels_association_sync_error", err, {
        labelId: event.association.labelId,
        type: event.association.type,
      });
    });
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(delayMs: number) {
  clearReconnectTimer();
  lastReconnectDelayMs = delayMs;
  logEvent("baileys.reconnecting", { attempt: reconnectAttempts, delayMs });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initBaileysSocket().catch((err) =>
      logError("baileys.reconnect_error", err, { attempt: reconnectAttempts }),
    );
  }, delayMs);
}

function getReadySocket(): WASocket {
  const status = getConnectionStatus();
  if (status.sessionReplaced) {
    throw new Error("WhatsApp session was replaced by another device. Re-enable the connection.");
  }

  if (!status.isReady) {
    throw new Error("WhatsApp socket is not ready yet. Wait for pending notifications to finish.");
  }

  return getSocket();
}

export async function sendContextualText(args: {
  body: string;
  phone: string;
  quotedMessageId?: string;
}) {
  const quotedMessage = await buildQuotedMessage({
    messageId: args.quotedMessageId,
    phone: args.phone,
    remoteJid: phoneToJid(args.phone),
  });

  return await sendText(args.phone, args.body, {
    quotedMessage,
  });
}
