/**
 * WhatsApp webhook routes.
 * GET  /api/webhooks/whatsapp  → Meta webhook challenge verification
 * POST /api/webhooks/whatsapp  → Incoming messages, calls, preferences, and outbound status updates
 */
import { db } from "@finanzas/db";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { logError, logEvent } from "../lib/logger";
import {
  recordInboundWhatsappCall,
  recordInboundWhatsappMessage,
  recordWhatsappUserPreference,
  syncWhatsappConversationStatus,
} from "../lib/whatsapp/conversation-state";

export const whatsappWebhookRoutes = new Hono();

whatsappWebhookRoutes.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return c.text("Webhook token not configured", 500);
  }

  if (mode === "subscribe" && token === verifyToken) {
    logEvent("whatsapp.webhook.verified", {});
    return c.text(challenge ?? "", 200);
  }

  return c.text("Forbidden", 403);
});

whatsappWebhookRoutes.post("/", async (c) => {
  const signature = c.req.header("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (appSecret && signature) {
    const rawBody = await c.req.text();
    let payload: null | WhatsappWebhookPayload = null;

    try {
      payload = JSON.parse(rawBody) as WhatsappWebhookPayload;
    } catch (err) {
      logError("whatsapp.webhook.parse_error", err, { hasSignature: true });
    }

    logEvent("whatsapp.webhook.post_received", {
      ...summarizePayload(payload),
      hasAppSecret: true,
      hasSignature: true,
    });

    const expectedSig =
      "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
    if (signature !== expectedSig) {
      logEvent("whatsapp.webhook.post_rejected", {
        ...summarizePayload(payload),
        hasSignature: true,
        reason: "invalid_signature",
      });
      return c.json({ status: "error", message: "Invalid signature" }, 403);
    }

    if (payload) {
      await processWebhookPayload(payload);
    }

    logEvent("whatsapp.webhook.post_accepted", {
      ...summarizePayload(payload),
      hasSignature: true,
      statusCode: 200,
    });
  } else {
    let payload: null | WhatsappWebhookPayload = null;

    try {
      payload = (await c.req.json()) as WhatsappWebhookPayload;
      logEvent("whatsapp.webhook.post_received", {
        ...summarizePayload(payload),
        hasAppSecret: Boolean(appSecret),
        hasSignature: false,
      });
      await processWebhookPayload(payload);
      logEvent("whatsapp.webhook.post_accepted", {
        ...summarizePayload(payload),
        hasSignature: false,
        statusCode: 200,
      });
    } catch (err) {
      logError("whatsapp.webhook.process_error", err, {
        hasAppSecret: Boolean(appSecret),
        hasSignature: false,
      });
    }
  }

  return c.json({ status: "ok" });
});

interface WhatsappConversationMeta {
  expiration_timestamp?: string;
  id?: string;
  origin?: { type?: string };
}

interface WhatsappStatusEntry {
  conversation?: WhatsappConversationMeta;
  errors?: Array<{ code: number; title: string }>;
  id: string;
  recipient_id?: string;
  status: "delivered" | "failed" | "played" | "read" | "sent";
  timestamp: string;
}

interface WhatsappIncomingMessage {
  from?: string;
  id: string;
  errors?: Array<{ code?: number; message?: string; title?: string }>;
  text?: {
    body?: string;
  };
  timestamp?: string;
  type?: string;
}

interface WhatsappCallEntry {
  event?: string;
  from?: string;
  id?: string;
  timestamp?: number | string;
  to?: string;
}

interface WhatsappUserPreferenceEntry {
  category?: string;
  timestamp?: number | string;
  value?: string;
  wa_id?: string;
}

interface WhatsappWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        calls?: WhatsappCallEntry[];
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: WhatsappIncomingMessage[];
        statuses?: WhatsappStatusEntry[];
        user_preferences?: WhatsappUserPreferenceEntry[];
      };
    }>;
  }>;
  object?: string;
}

function summarizePayload(payload: null | WhatsappWebhookPayload) {
  const changes = payload?.entry?.flatMap((entry) => entry.changes ?? []) ?? [];
  const fields = changes
    .map((change) => change.field)
    .filter((field): field is string => Boolean(field));
  const statusCount = changes.reduce(
    (count, change) => count + (change.value?.statuses?.length ?? 0),
    0,
  );
  const messageCount = changes.reduce(
    (count, change) => count + (change.value?.messages?.length ?? 0),
    0,
  );
  const callCount = changes.reduce(
    (count, change) => count + (change.value?.calls?.length ?? 0),
    0,
  );
  const preferenceCount = changes.reduce(
    (count, change) => count + (change.value?.user_preferences?.length ?? 0),
    0,
  );

  return {
    callCount,
    fieldCount: fields.length,
    fields,
    messageCount,
    object: payload?.object ?? null,
    preferenceCount,
    statusCount,
  };
}

async function processWebhookPayload(payload: WhatsappWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  const statuses: Array<{ status: WhatsappStatusEntry; waId: null | string }> = [];
  const incomingMessages: Array<{ message: WhatsappIncomingMessage; waId: null | string }> = [];
  const incomingCalls: Array<{ call: WhatsappCallEntry; waId: null | string }> = [];
  const userPreferences: Array<{ preference: WhatsappUserPreferenceEntry; waId: null | string }> =
    [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const waId = change.value?.contacts?.[0]?.wa_id ?? null;
      for (const message of change.value?.messages ?? []) {
        incomingMessages.push({ message, waId });
      }
      for (const status of change.value?.statuses ?? []) {
        statuses.push({ status, waId });
      }
      for (const call of change.value?.calls ?? []) {
        incomingCalls.push({ call, waId });
      }
      for (const preference of change.value?.user_preferences ?? []) {
        userPreferences.push({ preference, waId });
      }
    }
  }

  for (const { message, waId } of incomingMessages) {
    await handleIncomingMessage(message, waId);
  }

  for (const { call, waId } of incomingCalls) {
    await handleIncomingCall(call, waId);
  }

  for (const { preference, waId } of userPreferences) {
    await handleUserPreference(preference, waId);
  }

  for (const { status, waId } of statuses) {
    await updateNotificationStatus(status, waId);
  }
}

async function handleIncomingMessage(message: WhatsappIncomingMessage, waId: null | string) {
  if (!message.from || !message.id) {
    return;
  }

  if (message.type === "unsupported") {
    logEvent("whatsapp.webhook.unsupported_message", {
      errors: message.errors?.map((error) => ({
        code: error.code ?? null,
        message: error.message ?? null,
        title: error.title ?? null,
      })),
      messageId: message.id,
      phone: message.from,
      waId,
    });
    return;
  }

  try {
    const state = await recordInboundWhatsappMessage({
      from: message.from,
      messageId: message.id,
      text: message.text?.body ?? null,
      timestamp: message.timestamp ?? null,
      waId,
    });

    if (!state) {
      return;
    }

    logEvent("whatsapp.webhook.inbound_recorded", {
      messageId: message.id,
      phone: state.phone,
      type: message.type ?? "unknown",
      windowExpiresAt: state.windowExpiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    logError("whatsapp.webhook.inbound_record_error", err, {
      messageId: message.id,
      phone: message.from,
      type: message.type ?? "unknown",
    });
  }
}

async function handleIncomingCall(call: WhatsappCallEntry, waId: null | string) {
  if (!call.from) {
    return;
  }

  try {
    const state = await recordInboundWhatsappCall({
      callId: call.id ?? null,
      from: call.from,
      timestamp: call.timestamp != null ? String(call.timestamp) : null,
      waId,
    });

    if (!state) {
      return;
    }

    logEvent("whatsapp.webhook.call_recorded", {
      callId: call.id ?? null,
      event: call.event ?? "unknown",
      phone: state.phone,
      windowExpiresAt: state.windowExpiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    logError("whatsapp.webhook.call_record_error", err, {
      callId: call.id ?? null,
      phone: call.from,
    });
  }
}

async function handleUserPreference(
  preference: WhatsappUserPreferenceEntry,
  waId: null | string,
) {
  const phone = preference.wa_id ?? waId;
  if (!phone || !preference.value) {
    return;
  }

  const normalized = preference.value.toLowerCase();
  const nextPreference =
    normalized === "stop" || normalized === "opt_out"
      ? "OPTED_OUT"
      : normalized === "resume" || normalized === "start" || normalized === "opt_in"
        ? "OPTED_IN"
        : null;

  if (!nextPreference) {
    return;
  }

  try {
    const state = await recordWhatsappUserPreference({
      phone,
      preference: nextPreference,
      source: preference.category ?? "user_preference",
      timestamp: preference.timestamp != null ? String(preference.timestamp) : null,
      waId,
    });

    logEvent("whatsapp.webhook.preference_recorded", {
      optInStatus: state?.optInStatus ?? null,
      phone: state?.phone ?? phone,
      value: preference.value,
    });
  } catch (err) {
    logError("whatsapp.webhook.preference_record_error", err, {
      phone,
      value: preference.value,
    });
  }
}

async function updateNotificationStatus(entry: WhatsappStatusEntry, waId: null | string) {
  const now = new Date();

  try {
    if (entry.recipient_id) {
      await syncWhatsappConversationStatus({
        conversationId: entry.conversation?.id ?? null,
        expirationTimestamp: entry.conversation?.expiration_timestamp ?? null,
        originType: entry.conversation?.origin?.type ?? null,
        phone: entry.recipient_id,
        waId,
      });
    }

    const notification = await db.$qb
      .selectFrom("WhatsappNotification")
      .select(["id", "status"])
      .where("waMessageId", "=", entry.id)
      .executeTakeFirst();

    if (!notification) {
      return;
    }

    let updateValues: Record<string, unknown> = { updatedAt: now };

    if (entry.status === "sent") {
      updateValues = { ...updateValues, status: "SENT" };
    } else if (entry.status === "delivered") {
      updateValues = { ...updateValues, deliveredAt: now, status: "DELIVERED" };
    } else if (entry.status === "read") {
      updateValues = { ...updateValues, readAt: now, status: "READ" };
    } else if (entry.status === "played") {
      updateValues = { ...updateValues, playedAt: now, status: "PLAYED" };
    } else if (entry.status === "failed") {
      const errorMsg = entry.errors?.map((error) => error.title).join(", ") ?? "Unknown error";
      updateValues = { ...updateValues, errorMessage: errorMsg, status: "FAILED" };
    }

    await db.$qb
      .updateTable("WhatsappNotification")
      .set(updateValues)
      .where("waMessageId", "=", entry.id)
      .execute();

    logEvent("whatsapp.webhook.status_updated", {
      id: notification.id,
      newStatus: entry.status,
      waMessageId: entry.id,
    });
  } catch (err) {
    logError("whatsapp.webhook.update_error", err, { waMessageId: entry.id });
  }
}
