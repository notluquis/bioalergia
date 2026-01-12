import webpush from "web-push";
import { db } from "@finanzas/db";
import { logEvent, logWarn } from "../lib/logger";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:admin@finanzas.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function subscribeToPush(
  userId: number,
  subscription: { endpoint: string; keys: any }
) {
  return await db.pushSubscription.upsert({
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
}

export async function sendPushNotification(
  userId: number,
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return { success: false, sent: 0 };

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    data: {
      url: payload.url || "/",
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as unknown as { p256dh: string; auth: string },
        },
        notificationPayload
      )
    )
  );

  let sent = 0;
  // Cleanup invalid
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const error = result.reason;
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        await db.pushSubscription.delete({
          where: { id: subscriptions[index].id },
        });
      }
    }
  }

  return { success: true, sent };
}
