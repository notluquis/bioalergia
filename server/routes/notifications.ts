import express from "express";
import webpush from "web-push";
import { prisma, Prisma } from "../prisma.js";
import { logger } from "../lib/logger.js";

type DbSubscription = Prisma.PushSubscriptionGetPayload<{}>;

const router = express.Router();

// Configure web-push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@bioalergia.cl";

if (!publicVapidKey || !privateVapidKey) {
  logger.warn("VAPID keys are missing. Push notifications will not work.");
} else {
  webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);
}

// Subscribe endpoint
router.post("/subscribe", async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      res.status(400).json({ error: "Missing subscription or userId" });
      return;
    }

    // Save to DB
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: subscription.keys,
        userId: Number(userId),
      },
      create: {
        userId: Number(userId),
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
router.post("/send-test", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: Number(userId) },
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
