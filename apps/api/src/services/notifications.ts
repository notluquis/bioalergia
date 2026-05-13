import { db } from "@finanzas/db";
import webpush from "web-push";
import { logEvent } from "../lib/logger.ts";

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
//
// Payload split into `phi` (sender/preview that may carry protected
// health info) vs `generic` (safe fallback). The visible payload is
// chosen PER SUBSCRIPTION based on the owning user's
// `pushPreviewMode` setting — operators with mode=GENERIC never see
// PHI on their lock screen (HIPAA 2026 default per indigitall/
// healthcare 2026 best practices; Ley 21.719 sensitive-data
// minimization in Chile).
export async function broadcastPushNotification(payload: {
  // Safe baseline rendered to every device regardless of mode.
  // GENERIC users see this verbatim; SENDER_NAME/FULL users may see
  // sender/preview superimposed.
  generic: { title: string; body: string };
  // PHI-carrying enrichment shown to SENDER_NAME (title only) or
  // FULL (title + body). Omit to keep every device on the generic
  // payload (e.g. infra/test broadcasts).
  phi?: { sender: string; preview: string };
  icon?: string;
  // Optional rich preview thumbnail. Suppressed for GENERIC/
  // SENDER_NAME modes since an image can itself be PHI.
  image?: string;
  url?: string;
  // Tag lets the OS collapse repeated notifications from the same
  // conversation into one (per Web Notification API spec).
  tag?: string;
  // Org-wide unread count for the PWA badge. NOT PHI on its own;
  // sent to every mode.
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
  // Only push to subs whose owning user is currently ACTIVE.
  // Suspended/deactivated/pending users keep their row but stop
  // receiving notifications immediately — required for offboarding
  // an ex-employee without waiting for them to logout on their phone.
  // Logout itself also wipes the row server-side (orpc/auth.ts).
  // Include `pushPreviewMode` so we can render a per-user payload.
  const subscriptions = await db.pushSubscription.findMany({
    where: { user: { status: "ACTIVE" } },
    include: { user: { select: { pushPreviewMode: true } } },
  });
  if (subscriptions.length === 0) {
    return { success: true, sent: 0 };
  }

  const baseData = {
    icon: payload.icon || "/icons/icon-192x192.png",
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
  };
  // Pre-build a JSON payload per preview mode so we don't re-serialize
  // the common fields N times. Three modes total → at most 3 strings.
  const payloadByMode: Record<string, string> = {
    GENERIC: JSON.stringify({
      ...baseData,
      title: payload.generic.title,
      body: payload.generic.body,
      // GENERIC explicitly drops image because thumbnails can leak PHI
      // (a media message preview shows a patient's photo on the lock
      // screen even when title+body are scrubbed).
    }),
    SENDER_NAME: JSON.stringify({
      ...baseData,
      title: payload.phi?.sender ?? payload.generic.title,
      body: payload.phi ? "Mensaje nuevo" : payload.generic.body,
    }),
    FULL: JSON.stringify({
      ...baseData,
      title: payload.phi?.sender ?? payload.generic.title,
      body: payload.phi?.preview ?? payload.generic.body,
      image: payload.image,
    }),
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) => {
      const mode = sub.user?.pushPreviewMode ?? "GENERIC";
      const notificationPayload = payloadByMode[mode] ?? payloadByMode.GENERIC!;
      return webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as unknown as { p256dh: string; auth: string },
        },
        notificationPayload
      );
    })
  );

  let sent = 0;
  let dropped = 0;
  const failedStatusCodes: Record<number, number> = {};
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const error = result.reason as { statusCode?: number } | undefined;
      const code = error?.statusCode ?? 0;
      failedStatusCodes[code] = (failedStatusCodes[code] ?? 0) + 1;
      if (code === 410 || code === 404) {
        dropped++;
        await db.pushSubscription
          .delete({ where: { id: subscriptions[index].id } })
          .catch(() => undefined);
      }
    }
  }

  // HIPAA 2026 audit logging — every push attempt is logged with
  // tag + recipient counts per preview mode. NO PHI (no sender,
  // body, conversation contents). The tag links back to the source
  // event (e.g. "wa-conv-42") for ops-side correlation; the
  // operator who saw the push can be recovered from the
  // pushSubscription row at the time of the event.
  const modeBreakdown = subscriptions.reduce<Record<string, number>>((acc, s) => {
    const m = s.user?.pushPreviewMode ?? "GENERIC";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  logEvent("[notifications.broadcast]", {
    tag: payload.tag,
    kind: payload.kind ?? "notification",
    recipients: subscriptions.length,
    sent,
    failed: subscriptions.length - sent,
    dropped,
    modeBreakdown,
    failedStatusCodes,
  });

  return { success: true, sent };
}
