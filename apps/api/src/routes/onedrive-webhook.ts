import { Hono } from "hono";
import { db } from "@finanzas/db";
import { startClinicalSkinTestImportJob } from "../services/clinical-skin-test-scheduler.ts";
import { logError, logEvent, logWarn } from "../lib/logger.ts";

export const onedriveWebhookRoutes = new Hono();
const ONEDRIVE_WEBHOOK_CLIENT_STATE = "bioalergia-onedrive-sync";

onedriveWebhookRoutes.post("/", async (c) => {
  // 1. Validation request (synchronous — Microsoft needs the token echoed back immediately)
  const validationToken = c.req.query("validationToken");
  if (validationToken) {
    logEvent("onedrive.webhook.validation", {
      host: c.req.header("host") ?? null,
      userAgent: c.req.header("user-agent") ?? null,
      validationTokenLength: validationToken.length,
      xForwardedFor: c.req.header("x-forwarded-for") ?? null,
    });
    return c.text(validationToken, 200, { "Content-Type": "text/plain" });
  }

  // 2. Notification request
  // Respond 202 IMMEDIATELY — Graph marks the endpoint as unreliable if it takes > a few seconds.
  // All processing happens in a detached async chain so DB latency never delays the response.
  let payload: { value?: Array<{ clientState?: string; subscriptionId?: string }> } | null = null;
  try {
    payload = await c.req.json();
  } catch {
    // Malformed JSON — still respond 202, ignore silently
  }

  // Fire-and-forget: process after returning 202
  void processWebhookPayload(payload).catch((err) =>
    logError("onedrive.webhook.processing_error", err)
  );

  return c.text("Accepted", 202);
});

async function processWebhookPayload(
  payload: { value?: Array<{ clientState?: string; subscriptionId?: string }> } | null
) {
  if (!payload || !Array.isArray(payload.value)) return;

  let triggered = false;
  logEvent("onedrive.webhook.notifications.received", { count: payload.value.length });

  for (const notification of payload.value) {
    if (notification.subscriptionId && notification.clientState === ONEDRIVE_WEBHOOK_CLIENT_STATE) {
      const channel = await db.oneDriveWatchChannel.findFirst({
        where: { subscriptionId: notification.subscriptionId },
        select: { accountId: true },
      });

      if (channel && !triggered) {
        await startClinicalSkinTestImportJob({ force: false, trigger: "webhook" });
        triggered = true; // Only trigger one job per batch of notifications
      }
      if (!channel) {
        logWarn("onedrive.webhook.subscription_not_found", {
          subscriptionId: notification.subscriptionId,
        });
      }
    } else {
      logWarn("onedrive.webhook.notification_rejected", {
        hasClientState: Boolean(notification.clientState),
        hasSubscriptionId: Boolean(notification.subscriptionId),
      });
    }
  }
}
