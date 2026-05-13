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

// Swap an existing subscription's endpoint+keys atomically. Triggered
// by the SW `pushsubscriptionchange` event when the UA rotates the
// underlying push channel (Apple/FCM do this periodically). We DO
// NOT require a session here because the SW renewal happens in the
// background and Safari occasionally strips cookies on those fetches.
// The oldEndpoint acts as proof-of-possession — only the client that
// held the previous subscription knows it.
export async function rotatePushSubscription(
  oldEndpoint: string,
  next: { endpoint: string; keys: PushSubscriptionKeys }
) {
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint: oldEndpoint },
  });
  if (!existing) {
    return { success: false, reason: "old endpoint not found" as const };
  }
  // Upsert by the new endpoint to avoid a unique-constraint race if
  // the UA already pre-registered the new endpoint.
  await db.$transaction([
    db.pushSubscription.deleteMany({ where: { endpoint: oldEndpoint } }),
    db.pushSubscription.upsert({
      where: { endpoint: next.endpoint },
      update: { keys: next.keys, userId: existing.userId },
      create: { userId: existing.userId, endpoint: next.endpoint, keys: next.keys },
    }),
  ]);
  return { success: true };
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
  // Keep the OS banner up until the operator dismisses or acts on it.
  // For clinical messages (WhatsApp inbound) we set this true so a
  // banner doesn't auto-fade after 3s. Chromium-only; iOS/Safari
  // ignore the field but still render the banner.
  requireInteraction?: boolean;
  // True → no sound/vibration on the device (Chromium honors). For
  // background state syncs paired with `kind: "data"`.
  silent?: boolean;
  // Discriminator for the SW handler. "data" pushes carry only state
  // (badge count, conversation-read events from another device) and
  // the SW closes the notification immediately after the platform-
  // mandated showNotification call. Browsers may unsubscribe a SW
  // that receives push without surfacing a notification, so we still
  // call showNotification — just with `silent: true` and an instant
  // close. Default "notification" renders normally.
  kind?: "notification" | "data";
  // Action buttons rendered alongside the OS banner. Chromium honors
  // up to `Notification.maxActions` (typically 2). iOS 16.4+ PWAs
  // support "open" actions but not arbitrary backend calls — the SW
  // handler must short-circuit those gracefully. Labels MUST be
  // pre-localized here; SW has no i18n bundle.
  actions?: Array<{ action: string; title: string; icon?: string }>;
  // Free-form metadata propagated to event.notification.data. The SW
  // notificationclick handler reads it (e.g. conversationId so the
  // "mark-read" action can call the right endpoint).
  meta?: Record<string, unknown>;
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
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    kind: payload.kind ?? "notification",
    actions: payload.actions,
    timestamp: Date.now(),
    data: {
      url: payload.url || "/",
      badgeCount: payload.badgeCount,
      ...payload.meta,
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
