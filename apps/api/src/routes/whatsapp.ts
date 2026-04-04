/**
 * WhatsApp webhook routes.
 * GET  /api/webhooks/whatsapp  → Meta webhook challenge verification
 * POST /api/webhooks/whatsapp  → Incoming messages and outbound status updates
 */
import { db } from "@finanzas/db";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { logError, logEvent } from "../lib/logger";
import {
  recordInboundWhatsappMessage,
  touchWhatsappConversation,
} from "../lib/whatsapp/conversation-state";

export const whatsappWebhookRoutes = new Hono();

/** Meta webhook challenge verification (GET) */
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

/** Incoming WhatsApp webhook events (POST) */
whatsappWebhookRoutes.post("/", async (c) => {
  // Verify signature
  const signature = c.req.header("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (appSecret && signature) {
    const rawBody = await c.req.text();
    let payload: WhatsappWebhookPayload | null = null;

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
    let payload: WhatsappWebhookPayload | null = null;

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

  // Always return 200 to Meta to prevent retries
  return c.json({ status: "ok" });
});

interface WhatsappStatusEntry {
  conversation?: {
    expiration_timestamp?: string;
    id?: string;
    origin?: { type?: string };
  };
  id: string;
  recipient_id?: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsappIncomingMessage {
  from?: string;
  id: string;
  text?: {
    body?: string;
  };
  timestamp?: string;
  type?: string;
}

interface WhatsappWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{
          wa_id?: string;
        }>;
        statuses?: WhatsappStatusEntry[];
        messages?: WhatsappIncomingMessage[];
      };
    }>;
  }>;
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

  return {
    fieldCount: fields.length,
    fields,
    messageCount,
    object: payload?.object ?? null,
    statusCount,
  };
}

async function processWebhookPayload(payload: WhatsappWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  const statuses: WhatsappStatusEntry[] = [];
  const incomingMessages: Array<{ message: WhatsappIncomingMessage; waId: null | string }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const waId = change.value?.contacts?.[0]?.wa_id ?? null;
      for (const message of change.value?.messages ?? []) {
        incomingMessages.push({ message, waId });
      }
      for (const status of change.value?.statuses ?? []) {
        statuses.push(status);
      }
    }
  }

  for (const { message, waId } of incomingMessages) {
    await handleIncomingMessage(message, waId);
  }

  for (const status of statuses) {
    await updateNotificationStatus(status);
  }
}

async function handleIncomingMessage(message: WhatsappIncomingMessage, waId: null | string) {
  if (!message.from || !message.id) {
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

    logEvent("whatsapp.webhook.inbound_recorded", {
      messageId: message.id,
      phone: state.phone,
      type: message.type ?? "unknown",
      windowExpiresAt: state.windowExpiresAt.toISOString(),
    });
  } catch (err) {
    logError("whatsapp.webhook.inbound_record_error", err, {
      messageId: message.id,
      phone: message.from,
      type: message.type ?? "unknown",
    });
  }
}

async function updateNotificationStatus(entry: WhatsappStatusEntry) {
  const now = new Date();

  try {
    if (entry.recipient_id) {
      await touchWhatsappConversation({
        conversationId: entry.conversation?.id ?? null,
        phone: entry.recipient_id,
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

    if (entry.status === "delivered") {
      updateValues = { ...updateValues, deliveredAt: now, status: "DELIVERED" };
    } else if (entry.status === "read") {
      updateValues = { ...updateValues, readAt: now, status: "READ" };
    } else if (entry.status === "failed") {
      const errorMsg = entry.errors?.map((e) => e.title).join(", ") ?? "Unknown error";
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
