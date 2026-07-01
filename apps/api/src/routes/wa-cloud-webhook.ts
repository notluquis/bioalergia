import { db } from "@finanzas/db";
import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { logWarn } from "../lib/logger.ts";
import { decryptSecret } from "../lib/secret-cipher.ts";
import { processWebhookPayload, verifyMetaSignature } from "../modules/wa-cloud/webhook-handler.ts";
import { enqueueJob } from "../queue/runner.ts";
import { waPersistMediaJobKey } from "../queue/tasks/wa-persist-media.ts";
import { syncTemplates } from "../services/wa-templates.ts";
import { getPhoneHealth } from "../services/wa-analytics.ts";
import { notifyStaffComprobante } from "../services/abono-staff-notify.ts";
import { sendIntakeFlow } from "../services/intake.ts";

function timingSafeStringEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

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
  const ok = accounts.some((a) => {
    const decrypted = decryptSecret(a.webhookVerifyToken);
    return decrypted ? timingSafeStringEq(decrypted, token) : false;
  });
  if (!ok) return c.text("Token mismatch", 403);
  return c.text(challenge, 200);
});

// POST event delivery
waCloudWebhookRoutes.post("/whatsapp", async (c) => {
  const rawBody = await c.req.text();
  const sig = c.req.header("X-Hub-Signature-256");

  // Try verify against any account's appSecret. NOT filtered by `active` — the
  // signature is cryptographic and independent of whether we're allowed to send;
  // an inactive (banned) account still receives webhooks, including the
  // ACCOUNT_RECONNECTED / DISABLED_UPDATE=REINSTATE event that re-enables it.
  // Filtering by active here would deadlock re-enabling.
  let signatureValid = false;
  const accounts = await db.waBusinessAccount.findMany({
    where: { appSecret: { not: null } },
    select: { appSecret: true },
  });
  for (const a of accounts) {
    const sec = decryptSecret(a.appSecret);
    if (sec && verifyMetaSignature(rawBody, sig, sec)) {
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
    // Persist inbound media to R2 (durable; Meta media expires). Async via queue
    // → webhook stays fast; no-op fallback to live-proxy if the runner is off.
    for (const messageId of result.mediaMessageIds) {
      await enqueueJob("wa_persist_media", { messageId }, { jobKey: waPersistMediaJobKey(messageId) });
    }
    // Re-pull templates whose components were edited in Meta so the stored body
    // (used to render the real inbox text + to send) doesn't drift. Dedup +
    // fire-and-forget so the webhook still returns 200 fast.
    // ponytail: inline re-sync is fine — the edit event is rare; if a run is
    // missed it self-heals on the next edit or a manual "Sincronizar".
    for (const accountId of new Set(result.templateSyncAccountIds)) {
      void syncTemplates(accountId).catch((err) =>
        logWarn("[wa-cloud.webhook] template resync failed", {
          accountId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
    // Quality changed → re-fetch the real GREEN/YELLOW/RED rating from Graph
    // (the quality_update webhook only carries tier/event). getPhoneHealth
    // persists qualityRating. Dedup + fire-and-forget so the webhook stays fast.
    for (const phoneNumberId of new Set(result.phoneHealthRefreshIds)) {
      void getPhoneHealth({ phoneNumberId }).catch((err) =>
        logWarn("[wa-cloud.webhook] phone health refresh failed", {
          phoneNumberId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
    // Payment receipt from a patient → forward to the clinic staff's WhatsApp
    // (uploads media to Meta + sends the comprobante template). Fire-and-forget.
    for (const messageId of new Set(result.staffComprobanteMessageIds)) {
      void notifyStaffComprobante(messageId).catch((err) =>
        logWarn("[wa-cloud.webhook] staff comprobante notify failed", {
          messageId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
    // Patient with a PENDING abono just messaged (window open) → auto-send the
    // intake Flow. Idempotent in the service (flow_history marker). Fire-and-forget.
    for (const tokenId of new Set(result.intakeFlowTokenIds)) {
      void sendIntakeFlow(tokenId).catch((err) =>
        logWarn("[wa-cloud.webhook] intake flow auto-send failed", {
          tokenId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
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
