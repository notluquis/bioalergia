import { Hono } from "hono";
import { db } from "@finanzas/db";
import { startClinicalSkinTestImportJob } from "../lib/clinical-skin-tests/clinical-skin-test-scheduler";
import { logEvent, logWarn } from "../lib/logger";

export const onedriveWebhookRoutes = new Hono();
const ONEDRIVE_WEBHOOK_CLIENT_STATE = "bioalergia-onedrive-sync";

onedriveWebhookRoutes.post("/", async (c) => {
  // 1. Validation request
  const validationToken = c.req.query("validationToken");
  if (validationToken) {
    logEvent("onedrive.webhook.validation", {
      host: c.req.header("host") ?? null,
      userAgent: c.req.header("user-agent") ?? null,
      validationTokenLength: validationToken.length,
      xForwardedFor: c.req.header("x-forwarded-for") ?? null,
    });
    return c.text(validationToken, 200, {
      "Content-Type": "text/plain",
    });
  }

  // 2. Notification request
  try {
    const payload = await c.req.json<{ value?: Array<{ clientState?: string; subscriptionId?: string }> }>();
    if (payload && Array.isArray(payload.value)) {
      let triggered = false;
      logEvent("onedrive.webhook.notifications.received", {
        count: payload.value.length,
        host: c.req.header("host") ?? null,
      });
      
      for (const notification of payload.value) {
        if (notification.subscriptionId && notification.clientState === ONEDRIVE_WEBHOOK_CLIENT_STATE) {
          const channel = await db.oneDriveWatchChannel.findFirst({
            where: { subscriptionId: notification.subscriptionId },
            select: { accountId: true }
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
  } catch (error) {
    // Ignore invalid JSON payloads from malformed requests
    console.error("Error processing OneDrive webhook payload:", error);
  }

  // Microsoft Graph requires a 202 Accepted response for notifications
  return c.text("Accepted", 202);
});
