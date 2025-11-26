import express from "express";
import webpush from "web-push";
import { prisma, Prisma } from "../prisma.js";
import { logger } from "../lib/logger.js";
import { authenticate } from "../lib/http.js";
import type { AuthenticatedRequest } from "../types.js";

type DbSubscription = Prisma.PushSubscriptionGetPayload<{}>;

const router = express.Router();

// Apply authentication to all routes in this router
router.use(authenticate);

// ... vapid config

// Subscribe endpoint
router.post("/subscribe", async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { subscription } = req.body;
    const userId = authReq.auth?.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!subscription) {
      res.status(400).json({ error: "Missing subscription" });
      return;
    }

    // Save to DB
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: subscription.keys,
        userId: userId,
      },
      create: {
        userId: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
    });

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (error) {
    logger.error({ error }, "Error subscribing to push notifications");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// Send test notification
router.post("/send-test", async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    // Send to self
    const userId = authReq.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: userId },
    });

    if (subscriptions.length === 0) {
      res.status(404).json({ error: "No subscriptions found for user" });
      return;
    }

    const payload = JSON.stringify({
      title: "Finanzas App",
      body: "¡Esta es una notificación de prueba!",
      icon: "/pwa-192x192.png",
      data: {
        url: "/finanzas",
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub: DbSubscription) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as webpush.PushSubscription["keys"],
          },
          payload
        )
      )
    );

    // Cleanup invalid subscriptions (410 Gone or 404 Not Found)
    const failed = results.filter((r: PromiseSettledResult<unknown>) => r.status === "rejected");
    if (failed.length > 0) {
      logger.warn({ count: failed.length }, "Some notifications failed to send");
      // TODO: Implement cleanup logic for 410/404 errors
    }

    res.json({ message: "Test notification sent", results });
  } catch (error) {
    logger.error({ error }, "Error sending test notification");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

export default router;
