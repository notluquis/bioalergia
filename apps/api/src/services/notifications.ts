import { db } from "@finanzas/db";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:admin@finanzas.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// W3C Web Push API standard subscription keys
type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export async function subscribeToPush(
  userId: number,
  subscription: { endpoint: string; keys: PushSubscriptionKeys }
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

export async function unsubscribeFromPush(userId: number, endpoint: string) {
  return await db.pushSubscription.deleteMany({
    where: {
      endpoint,
      userId,
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

  if (subscriptions.length === 0) {
    return { success: false, sent: 0 };
  }

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

// Broadcast a push notification to every subscribed device. Used for
// events that any operator should see (e.g. inbound WhatsApp message
// landing in the shared inbox). Bad endpoints are GC'd in place.
export async function broadcastPushNotification(payload: {
  title: string;
  body: string;
  icon?: string;
  // Optional rich preview. WhatsApp media messages can map media
  // thumbnails here so the OS lockscreen shows the image alongside
  // the body. Spec: NotificationOptions.image (Chromium) /
  // attachment (Safari iOS 16.4+).
  image?: string;
  url?: string;
  // Tag lets the OS collapse repeated notifications from the same
  // conversation into one (per Web Notification API spec).
  tag?: string;
  // Unread count to paint on the PWA icon via the Badging API in the
  // SW push handler. Total per-device since the spec doesn't expose
  // per-user badges; for a shared inbox this is the org-wide unread
  // count, which is what the operator wants on a single-tenant clinic
  // PWA.
  badgeCount?: number;
}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { success: false, sent: 0, reason: "VAPID keys not configured" };
  }
  const subscriptions = await db.pushSubscription.findMany();
  if (subscriptions.length === 0) {
    return { success: true, sent: 0 };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    image: payload.image,
    tag: payload.tag,
    badgeCount: payload.badgeCount,
    timestamp: Date.now(),
    data: { url: payload.url || "/", badgeCount: payload.badgeCount },
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
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const error = result.reason as { statusCode?: number } | undefined;
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        await db.pushSubscription.delete({
          where: { id: subscriptions[index].id },
        }).catch(() => undefined);
      }
    }
  }

  return { success: true, sent };
}
