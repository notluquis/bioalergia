import { kysely, type SchemaType } from "@finanzas/db";
import type { Kysely } from "kysely";

type WhatsappBusinessQuickReplyRow = {
  count: number | null;
  created_at: Date | string;
  deleted: boolean;
  keywords: null | string[];
  message: string;
  shortcut: string;
  timestamp: string;
  updated_at: Date | string;
};

type WhatsappBusinessLabelRow = {
  color: number | null;
  created_at: Date | string;
  deleted: boolean;
  id: string;
  name: string | null;
  predefined_id: string | null;
  updated_at: Date | string;
};

type WhatsappBusinessChatLabelRow = {
  chat_jid: string;
  created_at: Date | string;
  label_id: string;
  updated_at: Date | string;
};

type WhatsappBusinessMessageLabelRow = {
  chat_jid: string;
  created_at: Date | string;
  label_id: string;
  message_id: string;
  updated_at: Date | string;
};

type WhatsappBusinessDb = SchemaType & {
  whatsapp_business_chat_labels: WhatsappBusinessChatLabelRow;
  whatsapp_business_labels: WhatsappBusinessLabelRow;
  whatsapp_business_message_labels: WhatsappBusinessMessageLabelRow;
  whatsapp_business_quick_replies: WhatsappBusinessQuickReplyRow;
};

const businessDb = kysely as unknown as Kysely<WhatsappBusinessDb>;

function asDate(value: Date | string | null | undefined) {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

export type WhatsappBusinessProfileRecord = {
  address?: string;
  businessHours: {
    config: Array<{
      closeTime?: number;
      dayOfWeek: string;
      mode: string;
      openTime?: number;
    }>;
    timezone?: string;
  } | null;
  category?: string;
  description: string;
  email?: string;
  website: string[];
  wid?: string;
};

export type WhatsappBusinessQuickReplyRecord = {
  count: number;
  deleted: boolean;
  keywords: string[];
  message: string;
  shortcut: string;
  timestamp: string;
  updatedAt: Date;
};

export type WhatsappBusinessLabelRecord = {
  color: number | null;
  deleted: boolean;
  id: string;
  name: string | null;
  predefinedId: string | null;
  updatedAt: Date;
};

export type WhatsappBusinessChatLabelRecord = {
  chatJid: string;
  labelId: string;
  labelName: string | null;
  updatedAt: Date;
};

export type WhatsappBusinessMessageLabelRecord = {
  chatJid: string;
  labelId: string;
  labelName: string | null;
  messageId: string;
  updatedAt: Date;
};

function mapQuickReply(row: WhatsappBusinessQuickReplyRow): WhatsappBusinessQuickReplyRecord {
  return {
    count: row.count ?? 0,
    deleted: row.deleted,
    keywords: row.keywords ?? [],
    message: row.message,
    shortcut: row.shortcut,
    timestamp: row.timestamp,
    updatedAt: asDate(row.updated_at),
  };
}

function mapLabel(row: WhatsappBusinessLabelRow): WhatsappBusinessLabelRecord {
  return {
    color: row.color,
    deleted: row.deleted,
    id: row.id,
    name: row.name,
    predefinedId: row.predefined_id,
    updatedAt: asDate(row.updated_at),
  };
}

export async function listWhatsappBusinessQuickReplies(args?: { includeDeleted?: boolean }) {
  const includeDeleted = args?.includeDeleted ?? false;
  let query = businessDb
    .selectFrom("whatsapp_business_quick_replies")
    .selectAll()
    .orderBy("updated_at", "desc");

  if (!includeDeleted) {
    query = query.where("deleted", "=", false);
  }

  const rows = await query.execute();
  return rows.map(mapQuickReply);
}

export async function upsertWhatsappBusinessQuickReply(input: {
  count?: number;
  deleted?: boolean;
  keywords?: string[];
  message: string;
  shortcut: string;
  timestamp: string;
}) {
  const now = new Date();

  await businessDb
    .insertInto("whatsapp_business_quick_replies")
    .values({
      count: input.count ?? 0,
      created_at: now,
      deleted: input.deleted ?? false,
      keywords: input.keywords ?? [],
      message: input.message,
      shortcut: input.shortcut,
      timestamp: input.timestamp,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("timestamp").doUpdateSet({
        count: input.count ?? 0,
        deleted: input.deleted ?? false,
        keywords: input.keywords ?? [],
        message: input.message,
        shortcut: input.shortcut,
        updated_at: now,
      }),
    )
    .execute();

  const row = await businessDb
    .selectFrom("whatsapp_business_quick_replies")
    .selectAll()
    .where("timestamp", "=", input.timestamp)
    .executeTakeFirstOrThrow();

  return mapQuickReply(row);
}

export async function markWhatsappBusinessQuickReplyDeleted(timestamp: string) {
  await businessDb
    .updateTable("whatsapp_business_quick_replies")
    .set({
      deleted: true,
      updated_at: new Date(),
    })
    .where("timestamp", "=", timestamp)
    .execute();
}

export async function listWhatsappBusinessLabels(args?: { includeDeleted?: boolean }) {
  const includeDeleted = args?.includeDeleted ?? false;
  let query = businessDb
    .selectFrom("whatsapp_business_labels")
    .selectAll()
    .orderBy("updated_at", "desc");

  if (!includeDeleted) {
    query = query.where("deleted", "=", false);
  }

  const rows = await query.execute();
  return rows.map(mapLabel);
}

export async function upsertWhatsappBusinessLabel(input: {
  color?: number | null;
  deleted?: boolean;
  id: string;
  name?: string | null;
  predefinedId?: string | null;
}) {
  const now = new Date();

  await businessDb
    .insertInto("whatsapp_business_labels")
    .values({
      color: input.color ?? null,
      created_at: now,
      deleted: input.deleted ?? false,
      id: input.id,
      name: input.name ?? null,
      predefined_id: input.predefinedId ?? null,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        color: input.color ?? null,
        deleted: input.deleted ?? false,
        name: input.name ?? null,
        predefined_id: input.predefinedId ?? null,
        updated_at: now,
      }),
    )
    .execute();

  const row = await businessDb
    .selectFrom("whatsapp_business_labels")
    .selectAll()
    .where("id", "=", input.id)
    .executeTakeFirstOrThrow();

  return mapLabel(row);
}

export async function upsertWhatsappBusinessChatLabel(input: { chatJid: string; labelId: string }) {
  const now = new Date();
  await businessDb
    .insertInto("whatsapp_business_chat_labels")
    .values({
      chat_jid: input.chatJid,
      created_at: now,
      label_id: input.labelId,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["label_id", "chat_jid"]).doUpdateSet({
        updated_at: now,
      }),
    )
    .execute();
}

export async function removeWhatsappBusinessChatLabel(input: { chatJid: string; labelId: string }) {
  await businessDb
    .deleteFrom("whatsapp_business_chat_labels")
    .where("chat_jid", "=", input.chatJid)
    .where("label_id", "=", input.labelId)
    .execute();
}

export async function upsertWhatsappBusinessMessageLabel(input: {
  chatJid: string;
  labelId: string;
  messageId: string;
}) {
  const now = new Date();
  await businessDb
    .insertInto("whatsapp_business_message_labels")
    .values({
      chat_jid: input.chatJid,
      created_at: now,
      label_id: input.labelId,
      message_id: input.messageId,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["label_id", "chat_jid", "message_id"]).doUpdateSet({
        updated_at: now,
      }),
    )
    .execute();
}

export async function removeWhatsappBusinessMessageLabel(input: {
  chatJid: string;
  labelId: string;
  messageId: string;
}) {
  await businessDb
    .deleteFrom("whatsapp_business_message_labels")
    .where("chat_jid", "=", input.chatJid)
    .where("label_id", "=", input.labelId)
    .where("message_id", "=", input.messageId)
    .execute();
}

export async function listWhatsappBusinessChatLabels(args?: { chatJid?: string; limit?: number }) {
  let query = businessDb
    .selectFrom("whatsapp_business_chat_labels as cl")
    .innerJoin("whatsapp_business_labels as l", "l.id", "cl.label_id")
    .select([
      "cl.chat_jid as chatJid",
      "cl.label_id as labelId",
      "cl.updated_at as updatedAt",
      "l.name as labelName",
    ])
    .orderBy("cl.updated_at", "desc");

  if (args?.chatJid) {
    query = query.where("cl.chat_jid", "=", args.chatJid);
  }

  if (args?.limit) {
    query = query.limit(args.limit);
  }

  return (await query.execute()).map((row) => ({
    chatJid: row.chatJid,
    labelId: row.labelId,
    labelName: row.labelName,
    updatedAt: asDate(row.updatedAt),
  }));
}

export async function listWhatsappBusinessMessageLabels(args?: {
  chatJid?: string;
  limit?: number;
  messageId?: string;
}) {
  let query = businessDb
    .selectFrom("whatsapp_business_message_labels as ml")
    .innerJoin("whatsapp_business_labels as l", "l.id", "ml.label_id")
    .select([
      "ml.chat_jid as chatJid",
      "ml.label_id as labelId",
      "ml.message_id as messageId",
      "ml.updated_at as updatedAt",
      "l.name as labelName",
    ])
    .orderBy("ml.updated_at", "desc");

  if (args?.chatJid) {
    query = query.where("ml.chat_jid", "=", args.chatJid);
  }

  if (args?.messageId) {
    query = query.where("ml.message_id", "=", args.messageId);
  }

  if (args?.limit) {
    query = query.limit(args.limit);
  }

  return (await query.execute()).map((row) => ({
    chatJid: row.chatJid,
    labelId: row.labelId,
    labelName: row.labelName,
    messageId: row.messageId,
    updatedAt: asDate(row.updatedAt),
  }));
}
