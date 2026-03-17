/**
 * WhatsApp webhook routes.
 * GET  /api/webhooks/whatsapp  → Meta webhook challenge verification
 * POST /api/webhooks/whatsapp  → Incoming status update events (delivered, read, failed)
 */
import { db } from "@finanzas/db";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { logError, logEvent } from "../lib/logger";

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

/** Incoming WhatsApp status events (POST) */
whatsappWebhookRoutes.post("/", async (c) => {
  // Verify signature
  const signature = c.req.header("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (appSecret && signature) {
    const rawBody = await c.req.text();
    const expectedSig =
      "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
    if (signature !== expectedSig) {
      return c.json({ status: "error", message: "Invalid signature" }, 403);
    }
    // Re-parse body since we consumed the stream
    try {
      const payload = JSON.parse(rawBody) as WhatsappWebhookPayload;
      await processWebhookPayload(payload);
    } catch (err) {
      logError("whatsapp.webhook.parse_error", err, {});
    }
  } else {
    try {
      const payload = (await c.req.json()) as WhatsappWebhookPayload;
      await processWebhookPayload(payload);
    } catch (err) {
      logError("whatsapp.webhook.process_error", err, {});
    }
  }

  // Always return 200 to Meta to prevent retries
  return c.json({ status: "ok" });
});

interface WhatsappStatusEntry {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsappWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: WhatsappStatusEntry[];
      };
    }>;
  }>;
}

async function processWebhookPayload(payload: WhatsappWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  const statuses: WhatsappStatusEntry[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        statuses.push(status);
      }
    }
  }

  if (statuses.length === 0) {
    return;
  }

  for (const status of statuses) {
    await updateNotificationStatus(status);
  }
}

async function updateNotificationStatus(entry: WhatsappStatusEntry) {
  const now = new Date();

  try {
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
