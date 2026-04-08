import { kysely, type SchemaType } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import type { Kysely } from "kysely";
import {
  getContentType,
  type Chat,
  type Contact,
  type WAMessage,
  type WAMessageKey,
  WAMessageStatus,
  type WAMessageUpdate,
} from "baileys";
import { isWhatsappUserJid, jidToPhone } from "./jid";

type WhatsappMessageDirection = "INBOUND" | "OUTBOUND";
type WhatsappMessageStatus = "DELIVERED" | "FAILED" | "PENDING" | "PLAYED" | "READ" | "RECEIVED" | "SENT";

type WhatsappMessageRow = {
  created_at: Date | string;
  delivered_at: Date | string | null;
  direction: WhatsappMessageDirection;
  from_me: boolean;
  id: string;
  message_id: string;
  message_timestamp: Date | string | null;
  message_type: string;
  participant_jid: string | null;
  participant_jid_key: string;
  phone: string | null;
  played_at: Date | string | null;
  raw_content_json: null | Record<string, unknown>;
  raw_message_json: null | Record<string, unknown>;
  read_at: Date | string | null;
  remote_jid: string;
  sent_at: Date | string | null;
  status: WhatsappMessageStatus;
  text_preview: string | null;
  updated_at: Date | string;
  wa_id: string | null;
};

type WhatsappChatRow = {
  archived: boolean | null;
  conversation_timestamp: Date | string | null;
  created_at: Date | string;
  id: string;
  jid: string;
  last_message_id: string | null;
  mute_end_time: Date | string | null;
  name: string | null;
  not_spam: boolean | null;
  pinned: boolean | null;
  raw_chat_json: null | Record<string, unknown>;
  unread_count: number | null;
  updated_at: Date | string;
};

type WhatsappContactRow = {
  created_at: Date | string;
  id: string;
  img_url: string | null;
  jid: string;
  name: string | null;
  notify: string | null;
  phone: string | null;
  raw_contact_json: null | Record<string, unknown>;
  updated_at: Date | string;
  verified_name: string | null;
};

type WhatsappHistoryDb = SchemaType & {
  whatsapp_chats: WhatsappChatRow;
  whatsapp_contacts: WhatsappContactRow;
  whatsapp_messages: WhatsappMessageRow;
};

const historyDb = kysely as unknown as Kysely<WhatsappHistoryDb>;

export type WhatsappMessageHistoryRecord = {
  createdAt: Date;
  deliveredAt: Date | null;
  direction: "inbound" | "outbound";
  fromMe: boolean;
  messageId: string;
  messageTimestamp: Date | null;
  messageType: string;
  participantJid: string | null;
  phone: string | null;
  playedAt: Date | null;
  readAt: Date | null;
  remoteJid: string;
  sentAt: Date | null;
  status: WhatsappMessageStatus;
  textPreview: string | null;
  updatedAt: Date;
  waId: string | null;
};

export type WhatsappChatRecord = {
  archived: boolean | null;
  conversationTimestamp: Date | null;
  jid: string;
  lastMessageId: string | null;
  muteEndTime: Date | null;
  name: string | null;
  notSpam: boolean | null;
  pinned: boolean | null;
  unreadCount: number | null;
  updatedAt: Date;
};

const STATUS_TIMESTAMP_FIELD: Record<Exclude<WhatsappMessageStatus, "FAILED" | "PENDING" | "RECEIVED" | "SENT">, keyof WhatsappMessageRow> = {
  DELIVERED: "delivered_at",
  PLAYED: "played_at",
  READ: "read_at",
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function messageTimestampToDate(value: WAMessage["messageTimestamp"]) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return new Date(numeric * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const numeric = Number(value.toString());
    return Number.isFinite(numeric) ? new Date(numeric * 1000) : null;
  }
  return null;
}

function participantKey(participantJid?: null | string) {
  return participantJid ?? "";
}

function toDirection(fromMe: boolean): WhatsappMessageDirection {
  return fromMe ? "OUTBOUND" : "INBOUND";
}

function toPublicDirection(direction: WhatsappMessageDirection) {
  return direction === "OUTBOUND" ? "outbound" : "inbound";
}

function getWaIdFromJid(jid?: null | string) {
  return jid ? jid.split("@")[0] ?? null : null;
}

function maybePhoneFromJid(jid?: null | string) {
  return jid && isWhatsappUserJid(jid) ? jidToPhone(jid) : null;
}

function messageTextPreview(message: WAMessage) {
  const content = message.message;
  if (!content) return null;

  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    content.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ??
    content.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ??
    content.reactionMessage?.text ??
    null
  );
}

function messageType(message: WAMessage) {
  return getContentType(message.message) ?? "unknown";
}

function mapMessage(row: WhatsappMessageRow): WhatsappMessageHistoryRecord {
  return {
    createdAt: asDate(row.created_at) ?? new Date(),
    deliveredAt: asDate(row.delivered_at),
    direction: toPublicDirection(row.direction),
    fromMe: row.from_me,
    messageId: row.message_id,
    messageTimestamp: asDate(row.message_timestamp),
    messageType: row.message_type,
    participantJid: row.participant_jid,
    phone: row.phone,
    playedAt: asDate(row.played_at),
    readAt: asDate(row.read_at),
    remoteJid: row.remote_jid,
    sentAt: asDate(row.sent_at),
    status: row.status,
    textPreview: row.text_preview,
    updatedAt: asDate(row.updated_at) ?? new Date(),
    waId: row.wa_id,
  };
}

function mapChat(row: WhatsappChatRow): WhatsappChatRecord {
  return {
    archived: row.archived,
    conversationTimestamp: asDate(row.conversation_timestamp),
    jid: row.jid,
    lastMessageId: row.last_message_id,
    muteEndTime: asDate(row.mute_end_time),
    name: row.name,
    notSpam: row.not_spam,
    pinned: row.pinned,
    unreadCount: row.unread_count,
    updatedAt: asDate(row.updated_at) ?? new Date(),
  };
}

export async function upsertWhatsappMessage(args: {
  message: WAMessage;
  status?: WhatsappMessageStatus;
}) {
  const { message, status } = args;
  const remoteJid = message.key.remoteJid;
  const messageId = message.key.id;
  if (!remoteJid || !messageId) {
    return null;
  }

  const now = new Date();
  const participantJid = message.key.participant ?? null;
  const nextStatus = status ?? (message.key.fromMe ? "SENT" : "RECEIVED");
  const sentAt = message.key.fromMe ? messageTimestampToDate(message.messageTimestamp) ?? now : null;

  await historyDb
    .insertInto("whatsapp_messages")
    .values({
      created_at: now,
      delivered_at: nextStatus === "DELIVERED" ? now : null,
      direction: toDirection(Boolean(message.key.fromMe)),
      from_me: Boolean(message.key.fromMe),
      id: createId(),
      message_id: messageId,
      message_timestamp: messageTimestampToDate(message.messageTimestamp),
      message_type: messageType(message),
      participant_jid: participantJid,
      participant_jid_key: participantKey(participantJid),
      phone: maybePhoneFromJid(remoteJid),
      played_at: nextStatus === "PLAYED" ? now : null,
      raw_content_json: (message.message as Record<string, unknown> | null | undefined) ?? null,
      raw_message_json: message as unknown as Record<string, unknown>,
      read_at: nextStatus === "READ" ? now : null,
      remote_jid: remoteJid,
      sent_at: sentAt,
      status: nextStatus,
      text_preview: messageTextPreview(message),
      updated_at: now,
      wa_id: getWaIdFromJid(remoteJid),
    })
    .onConflict((oc) =>
      oc.columns(["remote_jid", "message_id", "participant_jid_key"]).doUpdateSet({
        delivered_at: (eb) => eb.ref("excluded.delivered_at"),
        direction: (eb) => eb.ref("excluded.direction"),
        from_me: (eb) => eb.ref("excluded.from_me"),
        message_timestamp: (eb) => eb.ref("excluded.message_timestamp"),
        message_type: (eb) => eb.ref("excluded.message_type"),
        participant_jid: (eb) => eb.ref("excluded.participant_jid"),
        phone: (eb) => eb.ref("excluded.phone"),
        played_at: (eb) => eb.ref("excluded.played_at"),
        raw_content_json: (eb) => eb.ref("excluded.raw_content_json"),
        raw_message_json: (eb) => eb.ref("excluded.raw_message_json"),
        read_at: (eb) => eb.ref("excluded.read_at"),
        sent_at: (eb) => eb.ref("excluded.sent_at"),
        status: (eb) => eb.ref("excluded.status"),
        text_preview: (eb) => eb.ref("excluded.text_preview"),
        updated_at: now,
        wa_id: (eb) => eb.ref("excluded.wa_id"),
      }),
    )
    .execute();

  return await getWhatsappMessageByKey({
    id: messageId,
    participant: participantJid,
    remoteJid,
  });
}

export async function persistWhatsappHistorySet(args: {
  chats: Chat[];
  contacts: Contact[];
  messages: WAMessage[];
}) {
  await Promise.all([
    upsertWhatsappChats(args.chats),
    upsertWhatsappContacts(args.contacts),
    Promise.all(args.messages.map((message) => upsertWhatsappMessage({ message }))),
  ]);
}

export async function upsertWhatsappChats(chats: Chat[]) {
  const now = new Date();
  await Promise.all(
    chats
      .filter((chat) => Boolean(chat.id))
      .map(async (chat) => {
        await historyDb
          .insertInto("whatsapp_chats")
          .values({
            archived: chat.archive ?? false,
            conversation_timestamp: chat.conversationTimestamp
              ? new Date(Number(chat.conversationTimestamp) * 1000)
              : null,
            created_at: now,
            id: createId(),
            jid: chat.id,
            last_message_id: chat.messages?.[0]?.key?.id ?? null,
            mute_end_time: chat.muteEndTime ? new Date(Number(chat.muteEndTime) * 1000) : null,
            name: chat.name ?? null,
            not_spam: chat.notSpam ?? null,
            pinned: chat.pin ?? false,
            raw_chat_json: chat as unknown as Record<string, unknown>,
            unread_count: chat.unreadCount ?? null,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc.column("jid").doUpdateSet({
              archived: (eb) => eb.ref("excluded.archived"),
              conversation_timestamp: (eb) => eb.ref("excluded.conversation_timestamp"),
              last_message_id: (eb) => eb.ref("excluded.last_message_id"),
              mute_end_time: (eb) => eb.ref("excluded.mute_end_time"),
              name: (eb) => eb.ref("excluded.name"),
              not_spam: (eb) => eb.ref("excluded.not_spam"),
              pinned: (eb) => eb.ref("excluded.pinned"),
              raw_chat_json: (eb) => eb.ref("excluded.raw_chat_json"),
              unread_count: (eb) => eb.ref("excluded.unread_count"),
              updated_at: now,
            }),
          )
          .execute();
      }),
  );
}

export async function upsertWhatsappContacts(contacts: Contact[]) {
  const now = new Date();
  await Promise.all(
    contacts
      .filter((contact) => Boolean(contact.id))
      .map(async (contact) => {
        await historyDb
          .insertInto("whatsapp_contacts")
          .values({
            created_at: now,
            id: createId(),
            img_url: contact.imgUrl ?? null,
            jid: contact.id,
            name: contact.name ?? null,
            notify: contact.notify ?? null,
            phone: maybePhoneFromJid(contact.id),
            raw_contact_json: contact as unknown as Record<string, unknown>,
            updated_at: now,
            verified_name: contact.verifiedName ?? null,
          })
          .onConflict((oc) =>
            oc.column("jid").doUpdateSet({
              img_url: (eb) => eb.ref("excluded.img_url"),
              name: (eb) => eb.ref("excluded.name"),
              notify: (eb) => eb.ref("excluded.notify"),
              phone: (eb) => eb.ref("excluded.phone"),
              raw_contact_json: (eb) => eb.ref("excluded.raw_contact_json"),
              updated_at: now,
              verified_name: (eb) => eb.ref("excluded.verified_name"),
            }),
          )
          .execute();
      }),
  );
}

export async function applyWhatsappMessageUpdate(key: WAMessageKey, update: WAMessageUpdate) {
  if (!key.remoteJid || !key.id) {
    return null;
  }

  const now = new Date();
  const nextStatus = statusFromUpdate(update);
  const patch: Partial<WhatsappMessageRow> = {
    updated_at: now,
  };

  if (nextStatus) {
    patch.status = nextStatus;
    if (nextStatus === "SENT" && !patch.sent_at) {
      patch.sent_at = now;
    }
    if (nextStatus in STATUS_TIMESTAMP_FIELD) {
      patch[STATUS_TIMESTAMP_FIELD[nextStatus as keyof typeof STATUS_TIMESTAMP_FIELD]] = now;
    }
  }

  if (update.message) {
    patch.raw_content_json = update.message as unknown as Record<string, unknown>;
    patch.message_type = getContentType(update.message) ?? "unknown";
  }

  if (update.status == null && !update.message) {
    return await getWhatsappMessageByKey(key);
  }

  await historyDb
    .updateTable("whatsapp_messages")
    .set(patch)
    .where("remote_jid", "=", key.remoteJid)
    .where("message_id", "=", key.id)
    .where("participant_jid_key", "=", participantKey(key.participant))
    .execute();

  return await getWhatsappMessageByKey(key);
}

function statusFromUpdate(update: WAMessageUpdate): WhatsappMessageStatus | null {
  switch (update.status) {
    case WAMessageStatus.PENDING:
      return "PENDING";
    case WAMessageStatus.SERVER_ACK:
      return "SENT";
    case WAMessageStatus.DELIVERY_ACK:
      return "DELIVERED";
    case WAMessageStatus.READ:
      return "READ";
    case WAMessageStatus.PLAYED:
      return "PLAYED";
    case WAMessageStatus.ERROR:
      return "FAILED";
    default:
      return null;
  }
}

export async function getWhatsappMessageByKey(key: Pick<WAMessageKey, "id" | "participant" | "remoteJid">) {
  if (!key.remoteJid || !key.id) return null;

  const row = await historyDb
    .selectFrom("whatsapp_messages")
    .selectAll()
    .where("remote_jid", "=", key.remoteJid)
    .where("message_id", "=", key.id)
    .where("participant_jid_key", "=", participantKey(key.participant))
    .executeTakeFirst();

  return row ? mapMessage(row) : null;
}

export async function getWhatsappMessageContent(key: Pick<WAMessageKey, "id" | "participant" | "remoteJid">) {
  if (!key.remoteJid || !key.id) return undefined;

  const row = await historyDb
    .selectFrom("whatsapp_messages")
    .select(["raw_content_json"])
    .where("remote_jid", "=", key.remoteJid)
    .where("message_id", "=", key.id)
    .where("participant_jid_key", "=", participantKey(key.participant))
    .executeTakeFirst();

  return (row?.raw_content_json as WAMessage["message"] | undefined) ?? undefined;
}

export async function getWhatsappQuotedMessage(args: {
  messageId: string;
  phone?: string;
  remoteJid?: string;
}) {
  let query = historyDb
    .selectFrom("whatsapp_messages")
    .select(["raw_message_json"])
    .where("message_id", "=", args.messageId);

  if (args.remoteJid) {
    query = query.where("remote_jid", "=", args.remoteJid);
  } else if (args.phone) {
    query = query.where("phone", "=", args.phone);
  }

  const row = await query.orderBy("created_at", "desc").executeTakeFirst();
  return (row?.raw_message_json as WAMessage | undefined) ?? undefined;
}

export async function listWhatsappMessageHistory(args?: {
  direction?: "inbound" | "outbound";
  jid?: string;
  limit?: number;
  offset?: number;
  phone?: string;
  status?: WhatsappMessageStatus;
  type?: string;
}) {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;

  let query = historyDb
    .selectFrom("whatsapp_messages")
    .selectAll()
    .orderBy("created_at", "desc");

  let countQuery = historyDb
    .selectFrom("whatsapp_messages")
    .select((eb) => eb.fn.count<string>("id").as("count"));

  if (args?.phone) {
    query = query.where("phone", "=", args.phone);
    countQuery = countQuery.where("phone", "=", args.phone);
  }

  if (args?.jid) {
    query = query.where("remote_jid", "=", args.jid);
    countQuery = countQuery.where("remote_jid", "=", args.jid);
  }

  if (args?.direction) {
    const direction = args.direction === "outbound" ? "OUTBOUND" : "INBOUND";
    query = query.where("direction", "=", direction);
    countQuery = countQuery.where("direction", "=", direction);
  }

  if (args?.type) {
    query = query.where("message_type", "=", args.type);
    countQuery = countQuery.where("message_type", "=", args.type);
  }

  if (args?.status) {
    query = query.where("status", "=", args.status);
    countQuery = countQuery.where("status", "=", args.status);
  }

  const [rows, countRow] = await Promise.all([
    query.limit(limit).offset(offset).execute(),
    countQuery.executeTakeFirst(),
  ]);

  return {
    records: rows.map(mapMessage),
    total: Number(countRow?.count ?? 0),
  };
}

export async function getWhatsappConversationThread(args: {
  jid?: string;
  limit?: number;
  phone?: string;
}) {
  const limit = args.limit ?? 100;

  let query = historyDb
    .selectFrom("whatsapp_messages")
    .selectAll()
    .orderBy("created_at", "asc")
    .limit(limit);

  if (args.jid) {
    query = query.where("remote_jid", "=", args.jid);
  } else if (args.phone) {
    query = query.where("phone", "=", args.phone);
  }

  const rows = await query.execute();
  return rows.map(mapMessage);
}

export async function listWhatsappChats(args?: { limit?: number; offset?: number }) {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;

  const [rows, countRow] = await Promise.all([
    historyDb
      .selectFrom("whatsapp_chats")
      .selectAll()
      .orderBy("conversation_timestamp", "desc")
      .limit(limit)
      .offset(offset)
      .execute(),
    historyDb
      .selectFrom("whatsapp_chats")
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirst(),
  ]);

  return {
    records: rows.map(mapChat),
    total: Number(countRow?.count ?? 0),
  };
}
