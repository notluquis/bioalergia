import { kysely, type SchemaType } from "@finanzas/db";
import type { Kysely } from "kysely";
import { normalizePhone } from "./jid.ts";

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

type WhatsappOptInStatus = "OPTED_IN" | "OPTED_OUT" | "UNKNOWN";

type WhatsappConversationStateRow = {
  conversation_expires_at: Date | string | null;
  conversation_id: null | string;
  conversation_origin_type: null | string;
  created_at: Date | string;
  last_inbound_at: Date | string | null;
  last_inbound_call_at: Date | string | null;
  last_inbound_call_id: null | string;
  last_inbound_message_id: null | string;
  last_inbound_text: null | string;
  opt_in_source: null | string;
  opt_in_status: WhatsappOptInStatus;
  opted_in_at: Date | string | null;
  opted_out_at: Date | string | null;
  phone: string;
  updated_at: Date | string;
  wa_id: null | string;
  window_expires_at: Date | string | null;
};

type WhatsappConversationStateDb = SchemaType & {
  whatsapp_conversation_state: WhatsappConversationStateRow;
};

export type ConversationStateRecord = {
  conversationExpiresAt: Date | null;
  conversationId: null | string;
  conversationOriginType: null | string;
  createdAt: Date;
  lastInboundAt: Date | null;
  lastInboundCallAt: Date | null;
  lastInboundCallId: null | string;
  lastInboundMessageId: null | string;
  lastInboundText: null | string;
  optInSource: null | string;
  optInStatus: WhatsappOptInStatus;
  optedInAt: Date | null;
  optedOutAt: Date | null;
  phone: string;
  updatedAt: Date;
  waId: null | string;
  windowExpiresAt: Date | null;
};

type ConsentSummary = {
  optedIn: number;
  optedOut: number;
  total: number;
  unknown: number;
};

const conversationDb = kysely as unknown as Kysely<WhatsappConversationStateDb>;

function shouldAutoOptInOnInbound() {
  return process.env.WHATSAPP_AUTO_OPT_IN_ON_INBOUND !== "false";
}


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

function parseExpirationTimestamp(timestamp?: null | string) {
  if (!timestamp) {
    return null;
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1000);
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function mapConversationState(
  row: null | undefined | WhatsappConversationStateRow,
): ConversationStateRecord | null {
  if (!row) {
    return null;
  }

  return {
    conversationExpiresAt: asDate(row.conversation_expires_at),
    conversationId: row.conversation_id,
    conversationOriginType: row.conversation_origin_type,
    createdAt: asDate(row.created_at) ?? new Date(),
    lastInboundAt: asDate(row.last_inbound_at),
    lastInboundCallAt: asDate(row.last_inbound_call_at),
    lastInboundCallId: row.last_inbound_call_id,
    lastInboundMessageId: row.last_inbound_message_id,
    lastInboundText: row.last_inbound_text,
    optInSource: row.opt_in_source,
    optInStatus: row.opt_in_status,
    optedInAt: asDate(row.opted_in_at),
    optedOutAt: asDate(row.opted_out_at),
    phone: row.phone,
    updatedAt: asDate(row.updated_at) ?? new Date(),
    waId: row.wa_id,
    windowExpiresAt: asDate(row.window_expires_at),
  };
}

function latestActivityAt(state: ConversationStateRecord | null) {
  const candidates = [state?.lastInboundAt, state?.lastInboundCallAt].filter(
    (value): value is Date => value instanceof Date,
  );

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.max(...candidates.map((value) => value.getTime())));
}

function deriveWindowExpiresAt(args: {
  activityAt?: Date | null;
  canonicalExpiresAt?: Date | null;
  existing: ConversationStateRecord | null;
}) {
  const candidates: Date[] = [];

  if (args.canonicalExpiresAt) {
    candidates.push(args.canonicalExpiresAt);
  }

  if (args.activityAt) {
    candidates.push(new Date(args.activityAt.getTime() + CUSTOMER_SERVICE_WINDOW_MS));
  }

  if (args.existing?.windowExpiresAt) {
    candidates.push(args.existing.windowExpiresAt);
  }

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.max(...candidates.map((value) => value.getTime())));
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

export async function listWhatsappConversationStates(args?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;
  const search = args?.search?.trim();

  let query = conversationDb
    .selectFrom("whatsapp_conversation_state")
    .selectAll()
    .orderBy("updated_at", "desc");

  let countQuery = conversationDb
    .selectFrom("whatsapp_conversation_state")
    .select((eb) => eb.fn.count<string>("phone").as("count"));

  if (search) {
    const pattern = `%${search}%`;
    query = query.where((eb) =>
      eb.or([
        eb("phone", "ilike", pattern),
        eb("wa_id", "ilike", pattern),
      ]),
    );
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb("phone", "ilike", pattern),
        eb("wa_id", "ilike", pattern),
      ]),
    );
  }

  const [rows, countRow] = await Promise.all([
    query.limit(limit).offset(offset).execute(),
    countQuery.executeTakeFirst(),
  ]);

  return {
    records: rows
      .map((row) => mapConversationState(row))
      .filter((row): row is ConversationStateRecord => row != null),
    total: Number(countRow?.count ?? 0),
  };
}

export async function getWhatsappConsentSummary(): Promise<ConsentSummary> {
  const rows = await conversationDb
    .selectFrom("whatsapp_conversation_state")
    .select(["opt_in_status", conversationDb.fn.count<string>("phone").as("count")])
    .groupBy("opt_in_status")
    .execute();

  const counts: Record<WhatsappOptInStatus, number> = {
    OPTED_IN: 0,
    OPTED_OUT: 0,
    UNKNOWN: 0,
  };

  for (const row of rows) {
    counts[row.opt_in_status] = Number(row.count);
  }

  return {
    optedIn: counts.OPTED_IN,
    optedOut: counts.OPTED_OUT,
    total: counts.OPTED_IN + counts.OPTED_OUT + counts.UNKNOWN,
    unknown: counts.UNKNOWN,
  };
}

export async function setWhatsappContactConsent(args: {
  phone: string;
  source?: null | string;
  status: WhatsappOptInStatus;
  timestamp?: Date;
  waId?: null | string;
}) {
  const phone = normalizePhone(args.phone);
  const existing = await getWhatsappConversationState(phone);
  const now = args.timestamp ?? new Date();

  await conversationDb
    .insertInto("whatsapp_conversation_state")
    .values({
      conversation_expires_at: existing?.conversationExpiresAt ?? null,
      conversation_id: existing?.conversationId ?? null,
      conversation_origin_type: existing?.conversationOriginType ?? null,
      created_at: now,
      last_inbound_at: existing?.lastInboundAt ?? null,
      last_inbound_call_at: existing?.lastInboundCallAt ?? null,
      last_inbound_call_id: existing?.lastInboundCallId ?? null,
      last_inbound_message_id: existing?.lastInboundMessageId ?? null,
      last_inbound_text: existing?.lastInboundText ?? null,
      opt_in_source: args.source ?? existing?.optInSource ?? "manual",
      opt_in_status: args.status,
      opted_in_at: args.status === "OPTED_IN" ? now : existing?.optedInAt ?? null,
      opted_out_at: args.status === "OPTED_OUT" ? now : null,
      phone,
      updated_at: now,
      wa_id: args.waId ?? existing?.waId ?? phone,
      window_expires_at: existing?.windowExpiresAt ?? null,
    })
    .onConflict((oc) =>
      oc.column("phone").doUpdateSet({
        opt_in_source: args.source ?? existing?.optInSource ?? "manual",
        opt_in_status: args.status,
        opted_in_at: args.status === "OPTED_IN" ? now : existing?.optedInAt ?? null,
        opted_out_at: args.status === "OPTED_OUT" ? now : null,
        updated_at: now,
        wa_id: args.waId ?? existing?.waId ?? phone,
      }),
    )
    .execute();

  return await getWhatsappConversationState(phone);
}

async function upsertWhatsappConversation(args: {
  activityAt?: Date | null;
  activityType?: "call" | "message";
  canonicalExpiresAt?: Date | null;
  conversationId?: null | string;
  conversationOriginType?: null | string;
  from: string;
  messageId?: null | string;
  optInSource?: null | string;
  text?: null | string;
  waId?: null | string;
}) {
  const phone = normalizePhone(args.from);
  const existing = await getWhatsappConversationState(phone);
  const now = new Date();
  const activityAt = args.activityAt ?? null;
  const currentLatestActivity = latestActivityAt(existing);
  const isOlderActivity =
    activityAt != null &&
    currentLatestActivity != null &&
    currentLatestActivity.getTime() > activityAt.getTime();

  const lastInboundAt =
    args.activityType === "message" && activityAt && !isOlderActivity
      ? activityAt
      : existing?.lastInboundAt ?? null;
  const lastInboundMessageId =
    args.activityType === "message" && !isOlderActivity
      ? args.messageId ?? existing?.lastInboundMessageId ?? null
      : existing?.lastInboundMessageId ?? null;
  const lastInboundText =
    args.activityType === "message" && !isOlderActivity
      ? args.text ?? null
      : existing?.lastInboundText ?? null;
  const lastInboundCallAt =
    args.activityType === "call" && activityAt && !isOlderActivity
      ? activityAt
      : existing?.lastInboundCallAt ?? null;
  const lastInboundCallId =
    args.activityType === "call" && !isOlderActivity
      ? args.messageId ?? existing?.lastInboundCallId ?? null
      : existing?.lastInboundCallId ?? null;
  const conversationExpiresAt =
    args.canonicalExpiresAt ??
    existing?.conversationExpiresAt ??
    null;
  const windowExpiresAt = deriveWindowExpiresAt({
    activityAt,
    canonicalExpiresAt:
      args.conversationOriginType === "service" ? args.canonicalExpiresAt ?? null : null,
    existing,
  });
  const shouldAutoOptIn =
    shouldAutoOptInOnInbound() &&
    activityAt != null &&
    !isOlderActivity &&
    existing?.optInStatus !== "OPTED_OUT";
  const nextOptInStatus =
    shouldAutoOptIn && (args.activityType === "message" || args.activityType === "call")
      ? "OPTED_IN"
      : existing?.optInStatus ?? "UNKNOWN";
  const nextOptedInAt =
    nextOptInStatus === "OPTED_IN"
      ? existing?.optedInAt ?? activityAt ?? now
      : existing?.optedInAt ?? null;
  const nextOptedOutAt = nextOptInStatus === "OPTED_OUT" ? existing?.optedOutAt ?? now : null;
  const nextOptInSource =
    shouldAutoOptIn
      ? args.optInSource ?? `inbound_${args.activityType}`
      : existing?.optInSource ?? null;
  const conversationId = args.conversationId ?? existing?.conversationId ?? null;
  const waId = args.waId ?? existing?.waId ?? phone;
  const conversationOriginType = args.conversationOriginType ?? existing?.conversationOriginType ?? null;

  await conversationDb
    .insertInto("whatsapp_conversation_state")
    .values({
      conversation_expires_at: conversationExpiresAt,
      conversation_id: conversationId,
      conversation_origin_type: conversationOriginType,
      created_at: now,
      last_inbound_at: lastInboundAt,
      last_inbound_call_at: lastInboundCallAt,
      last_inbound_call_id: lastInboundCallId,
      last_inbound_message_id: lastInboundMessageId,
      last_inbound_text: lastInboundText,
      opt_in_source: nextOptInSource,
      opt_in_status: nextOptInStatus,
      opted_in_at: nextOptedInAt,
      opted_out_at: nextOptedOutAt,
      phone,
      updated_at: now,
      wa_id: waId,
      window_expires_at: windowExpiresAt,
    })
    .onConflict((oc) =>
      oc.column("phone").doUpdateSet({
        conversation_expires_at: conversationExpiresAt,
        conversation_id: conversationId,
        conversation_origin_type: conversationOriginType,
        last_inbound_at: lastInboundAt,
        last_inbound_call_at: lastInboundCallAt,
        last_inbound_call_id: lastInboundCallId,
        last_inbound_message_id: lastInboundMessageId,
        last_inbound_text: lastInboundText,
        opt_in_source: nextOptInSource,
        opt_in_status: nextOptInStatus,
        opted_in_at: nextOptedInAt,
        opted_out_at: nextOptedOutAt,
        updated_at: now,
        wa_id: waId,
        window_expires_at: windowExpiresAt,
      }),
    )
    .execute();

  return await getWhatsappConversationState(phone);
}

export async function recordInboundWhatsappMessage(args: {
  conversationId?: null | string;
  conversationOriginType?: null | string;
  from: string;
  messageId: string;
  text?: null | string;
  timestamp?: null | string;
  waId?: null | string;
  windowExpiresAt?: Date | null;
}) {
  return await upsertWhatsappConversation({
    activityAt: parseWebhookTimestamp(args.timestamp),
    activityType: "message",
    canonicalExpiresAt: args.windowExpiresAt ?? null,
    conversationId: args.conversationId ?? null,
    conversationOriginType: args.conversationOriginType ?? null,
    from: args.from,
    messageId: args.messageId,
    optInSource: "inbound_message",
    text: args.text ?? null,
    waId: args.waId ?? null,
  });
}

export async function recordInboundWhatsappCall(args: {
  conversationId?: null | string;
  conversationOriginType?: null | string;
  from: string;
  timestamp?: null | string;
  callId?: null | string;
  waId?: null | string;
  windowExpiresAt?: Date | null;
}) {
  return await upsertWhatsappConversation({
    activityAt: parseWebhookTimestamp(args.timestamp),
    activityType: "call",
    canonicalExpiresAt: args.windowExpiresAt ?? null,
    conversationId: args.conversationId ?? null,
    conversationOriginType: args.conversationOriginType ?? null,
    from: args.from,
    messageId: args.callId ?? null,
    optInSource: "inbound_call",
    waId: args.waId ?? null,
  });
}

export async function recordWhatsappUserPreference(args: {
  phone: string;
  preference: "OPTED_IN" | "OPTED_OUT";
  source?: null | string;
  timestamp?: null | string;
  waId?: null | string;
}) {
  return await setWhatsappContactConsent({
    phone: args.phone,
    source: args.source ?? "user_preference",
    status: args.preference,
    timestamp: parseWebhookTimestamp(args.timestamp),
    waId: args.waId ?? null,
  });
}
