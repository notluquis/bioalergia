/**
 * Push Notification Routes for Hono API
 *
 * Manages push notification subscriptions and sending
 */

import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { db } from "@finanzas/db";

const JWT_SECRET = process.env.JWT_SECRET || "";
const COOKIE_NAME = "finanzas_session";

// VAPID keys from environment
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";

export const notificationRoutes = new Hono();

// Helper to get auth
function getAuth(c: { req: { header: (name: string) => string | undefined } }) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("=")),
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return { userId: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

// ============================================================
// SUBSCRIBE TO PUSH
// ============================================================

notificationRoutes.post("/subscribe", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const { subscription } = await c.req.json<{
    subscription: { endpoint: string; keys: object };
  }>();

  if (!subscription || !subscription.endpoint) {
    return c.json({ status: "error", message: "Subscription required" }, 400);
  }

  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      keys: subscription.keys as Record<string, any>,
      userId: auth.userId,
    },
    create: {
      userId: auth.userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys as Record<string, any>,
    },
  });

  console.log("[Push] Subscribed:", auth.email);
  return c.json({ status: "ok", message: "Subscribed successfully" }, 201);
});

// ============================================================
// SEND TEST NOTIFICATION
// ============================================================

notificationRoutes.post("/send-test", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  // Dynamic import for web-push to avoid loading if not configured
  let webpush;
  try {
    webpush = await import("web-push");
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    }
  } catch {
    return c.json({ status: "error", message: "web-push not available" }, 500);
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: auth.userId },
  });

  if (subscriptions.length === 0) {
    return c.json({ status: "error", message: "No subscriptions found" }, 404);
  }

  const payload = JSON.stringify({
    title: "Finanzas App",
    body: "¡Esta es una notificación de prueba!",
    icon: "/pwa-192x192.png",
    data: { url: "/finanzas" },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        },
        payload,
      ),
    ),
  );

  // Cleanup expired subscriptions (410 Gone)
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      const error = result.reason as { statusCode?: number };
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.pushSubscription.delete({
          where: { endpoint: subscriptions[index].endpoint },
        });
        console.log("[Push] Cleaned up expired subscription");
      }
    }
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  console.log(
    "[Push] Sent test notification to",
    auth.email,
    ":",
    sent,
    "/",
    results.length,
  );
  return c.json({ status: "ok", sent, total: results.length });
});

// ============================================================
// UNSUBSCRIBE
// ============================================================

notificationRoutes.delete("/unsubscribe", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const { endpoint } = await c.req.json<{ endpoint: string }>();

  if (!endpoint) {
    return c.json({ status: "error", message: "Endpoint required" }, 400);
  }

  await db.pushSubscription.delete({ where: { endpoint } });

  console.log("[Push] Unsubscribed:", auth.email);
  return c.json({ status: "ok" });
});
