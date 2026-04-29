import { db } from "@finanzas/db";
import { Hono } from "hono";
import { logWarn } from "../lib/logger";
import { processWebhookPayload, verifyMetaSignature } from "../modules/wa-cloud/webhook-handler";

export const waCloudWebhookRoutes = new Hono();

// GET verify (Meta sends hub.challenge once when registering webhook)
waCloudWebhookRoutes.get("/whatsapp", async (c) => {
  const mode = c.req.query("hub.mode");
  const challenge = c.req.query("hub.challenge");
  const token = c.req.query("hub.verify_token");
  if (mode !== "subscribe" || !token || !challenge) {
    return c.text("Invalid verify request", 400);
  }
  // Match against ANY active account's verify token
  const accounts = await db.waBusinessAccount.findMany({
    where: { active: true, webhookVerifyToken: { not: null } },
    select: { webhookVerifyToken: true },
  });
  const ok = accounts.some((a) => a.webhookVerifyToken === token);
  if (!ok) return c.text("Token mismatch", 403);
  return c.text(challenge, 200);
});

// POST event delivery
waCloudWebhookRoutes.post("/whatsapp", async (c) => {
  const rawBody = await c.req.text();
  const sig = c.req.header("X-Hub-Signature-256");

  // Try verify against any account's appSecret
  let signatureValid = false;
  const accounts = await db.waBusinessAccount.findMany({
    where: { active: true, appSecret: { not: null } },
    select: { appSecret: true },
  });
  for (const a of accounts) {
    if (a.appSecret && verifyMetaSignature(rawBody, sig, a.appSecret)) {
      signatureValid = true;
      break;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = { raw: rawBody };
  }

  // Always log
  const log = await db.waWebhookLog.create({
    data: {
      signatureValid,
      payload: parsed as never,
      processed: false,
    },
  });

  if (!signatureValid) {
    logWarn("[wa-cloud.webhook] signature INVALID", { logId: log.id });
    // Meta still expects 200 to stop retry, but mark log
    return c.text("OK", 200);
  }

  try {
    const result = await processWebhookPayload(parsed as never);
    await db.waWebhookLog.update({
      where: { id: log.id },
      data: {
        processed: true,
        eventCount: result.events,
        errorMessage: result.errors.length ? result.errors.join("; ").slice(0, 1000) : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn("[wa-cloud.webhook] process failed", { error: msg });
    await db.waWebhookLog.update({
      where: { id: log.id },
      data: { errorMessage: msg.slice(0, 1000) },
    });
  }

  return c.text("OK", 200);
});
