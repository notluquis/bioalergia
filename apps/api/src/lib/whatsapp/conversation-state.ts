import { kysely, type SchemaType } from "@finanzas/db";
import type { Kysely } from "kysely";
import { normalizePhone } from "./whatsapp-client";

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

type WhatsappConversationStateRow = {
  conversation_id: null | string;
  created_at: Date | string;
  last_inbound_at: Date | string | null;
  last_inbound_message_id: null | string;
  last_inbound_text: null | string;
  phone: string;
  updated_at: Date | string;
  wa_id: null | string;
  window_expires_at: Date | string | null;
};

type WhatsappConversationStateDb = SchemaType & {
  whatsapp_conversation_state: WhatsappConversationStateRow;
};

type ConversationStateRecord = {
  conversationId: null | string;
  lastInboundAt: Date | null;
  lastInboundMessageId: null | string;
  lastInboundText: null | string;
  phone: string;
  updatedAt: Date;
  waId: null | string;
  windowExpiresAt: Date | null;
};

const conversationDb = kysely as unknown as Kysely<WhatsappConversationStateDb>;

function parseWebhookTimestamp(timestamp?: null | string) {
  if (!timestamp) {
    return new Date();
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1000);
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function mapConversationState(
  row: null | WhatsappConversationStateRow | undefined,
): ConversationStateRecord | null {
  if (!row) {
    return null;
  }

  return {
    conversationId: row.conversation_id,
    lastInboundAt: asDate(row.last_inbound_at),
    lastInboundMessageId: row.last_inbound_message_id,
    lastInboundText: row.last_inbound_text,
    phone: row.phone,
    updatedAt: asDate(row.updated_at) ?? new Date(),
    waId: row.wa_id,
    windowExpiresAt: asDate(row.window_expires_at),
  };
}

export async function getWhatsappConversationState(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const row = await conversationDb
    .selectFrom("whatsapp_conversation_state")
    .selectAll()
    .where("phone", "=", normalizedPhone)
    .executeTakeFirst();

  return mapConversationState(row);
}

export async function hasActiveCustomerServiceWindow(phone: string, now = new Date()) {
  try {
    const state = await getWhatsappConversationState(phone);
    if (!state?.windowExpiresAt) {
      return false;
    }
    return state.windowExpiresAt.getTime() > now.getTime();
  } catch {
    return false;
  }
}

export async function countActiveCustomerServiceWindows(now = new Date()) {
  const row = await conversationDb
    .selectFrom("whatsapp_conversation_state")
    .select((eb) => eb.fn.count<string>("phone").as("count"))
    .where("window_expires_at", ">", now)
    .executeTakeFirst();

  return Number(row?.count ?? 0);
}

export async function recordInboundWhatsappMessage(args: {
  conversationId?: null | string;
  from: string;
  messageId: string;
  text?: null | string;
  timestamp?: null | string;
  waId?: null | string;
}) {
  const phone = normalizePhone(args.from);
  const inboundAt = parseWebhookTimestamp(args.timestamp);
  const existing = await getWhatsappConversationState(phone);
  const isOlderThanStored =
    existing?.lastInboundAt != null && existing.lastInboundAt.getTime() > inboundAt.getTime();
  const latestInboundAt = isOlderThanStored ? existing.lastInboundAt! : inboundAt;
  const latestMessageId = isOlderThanStored ? existing?.lastInboundMessageId ?? args.messageId : args.messageId;
  const latestText = isOlderThanStored ? existing?.lastInboundText ?? args.text ?? null : args.text ?? null;
  const conversationId = args.conversationId ?? existing?.conversationId ?? null;
  const waId = args.waId ?? existing?.waId ?? phone;
  const now = new Date();
  const windowExpiresAt = new Date(latestInboundAt.getTime() + CUSTOMER_SERVICE_WINDOW_MS);

  await conversationDb
    .insertInto("whatsapp_conversation_state")
    .values({
      conversation_id: conversationId,
      created_at: now,
      last_inbound_at: latestInboundAt,
      last_inbound_message_id: latestMessageId,
      last_inbound_text: latestText,
      phone,
      updated_at: now,
      wa_id: waId,
      window_expires_at: windowExpiresAt,
    })
    .onConflict((oc) =>
      oc.column("phone").doUpdateSet({
        conversation_id: conversationId,
        last_inbound_at: latestInboundAt,
        last_inbound_message_id: latestMessageId,
        last_inbound_text: latestText,
        updated_at: now,
        wa_id: waId,
        window_expires_at: windowExpiresAt,
      }),
    )
    .execute();

  return {
    phone,
    windowExpiresAt,
  };
}

export async function touchWhatsappConversation(args: {
  conversationId?: null | string;
  phone: string;
}) {
  const phone = normalizePhone(args.phone);
  const existing = await getWhatsappConversationState(phone);
  if (!existing) {
    return null;
  }

  const now = new Date();
  await conversationDb
    .updateTable("whatsapp_conversation_state")
    .set({
      conversation_id: args.conversationId ?? existing.conversationId,
      updated_at: now,
    })
    .where("phone", "=", phone)
    .execute();

  return {
    ...existing,
    conversationId: args.conversationId ?? existing.conversationId,
    updatedAt: now,
  };
}
