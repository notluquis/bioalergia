import { Hono } from "hono";
import { db } from "@finanzas/db";
import { startClinicalSkinTestImportJob } from "../lib/clinical-skin-tests/clinical-skin-test-scheduler";

export const onedriveWebhookRoutes = new Hono();

onedriveWebhookRoutes.post("/", async (c) => {
  // 1. Validation request
  const validationToken = c.req.query("validationToken");
  if (validationToken) {
    return c.text(validationToken, 200, {
      "Content-Type": "text/plain",
    });
  }

  // 2. Notification request
  try {
    const payload = await c.req.json<{ value?: Array<{ subscriptionId?: string }> }>();
    if (payload && Array.isArray(payload.value)) {
      let triggered = false;
      
      for (const notification of payload.value) {
        if (notification.subscriptionId) {
          const channel = await db.oneDriveWatchChannel.findFirst({
            where: { subscriptionId: notification.subscriptionId },
            select: { accountId: true }
          });
            
          if (channel && !triggered) {
            await startClinicalSkinTestImportJob({ force: false, trigger: "webhook" });
            triggered = true; // Only trigger one job per batch of notifications
          }
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
