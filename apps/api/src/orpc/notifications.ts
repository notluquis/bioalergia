import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  dismissedInputSchema,
  notificationsStatusResponseSchema,
  previewModeResponseSchema,
  rotateInputSchema,
  sendTestInputSchema,
  setPreviewModeInputSchema,
  subscribeInputSchema,
  unreadCountResponseSchema,
  unsubscribeInputSchema,
} from "@finanzas/orpc-contracts/notifications";
import { db } from "@finanzas/db";
import { logEvent } from "../lib/logger.ts";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  rotatePushSubscription,
  sendPushNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from "../services/notifications.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type NotificationsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<NotificationsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readNotifications = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Notification");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const notificationsORPCRouterBase = {
  sendTest: readNotifications
    .route({
      method: "POST",
      path: "/send-test",
      summary: "Send a test push notification",
      tags: ["Notifications"],
    })
    .input(sendTestInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ context }) => {
      return sendPushNotification(context.user.id, {
        title: "Test Notification",
        body: "This is a test from the new API!",
      });
    }),

  subscribe: authed
    .route({
      method: "POST",
      path: "/subscribe",
      summary: "Subscribe the current user to push notifications",
      tags: ["Notifications"],
    })
    .input(subscribeInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ context, input }) => {
      await subscribeToPush(context.user.id, input.subscription);
      return { message: "Subscribed successfully", status: "ok" };
    }),

  unsubscribe: authed
    .route({
      method: "POST",
      path: "/unsubscribe",
      summary: "Unsubscribe the current user from push notifications",
      tags: ["Notifications"],
    })
    .input(unsubscribeInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ context, input }) => {
      await unsubscribeFromPush(context.user.id, input.endpoint);
      return { message: "Unsubscribed successfully", status: "ok" };
    }),

  // SW notificationclose analytics — fire-and-forget log. No DB
  // row to keep cardinality low on a single-tenant clinic; the log
  // line is enough for ops to compute dismissal rate via grep.
  // Unauthed for the same reason as rotate (Safari iOS may strip
  // cookies on background fetches).
  dismissed: base
    .route({
      method: "POST",
      path: "/dismissed",
      summary: "Log a notification dismissal (SW notificationclose)",
      tags: ["Notifications"],
    })
    .input(dismissedInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ input }) => {
      logEvent("[notifications.dismissed]", {
        tag: input.tag,
        conversationId: input.conversationId,
      });
      return { status: "ok", success: true };
    }),

  // Privacy gate for Web Push payloads. Operator selects how much
  // PHI may appear on the lock screen — GENERIC is the default per
  // HIPAA 2026 / Ley 21.719 recommendations.
  getPreviewMode: authed
    .route({
      method: "GET",
      path: "/preview-mode",
      summary: "Get the current user's push preview mode",
      tags: ["Notifications"],
    })
    .output(previewModeResponseSchema)
    .handler(async ({ context }) => {
      const u = await db.user.findUnique({
        where: { id: context.user.id },
        select: { pushPreviewMode: true },
      });
      return { mode: (u?.pushPreviewMode ?? "GENERIC") as "GENERIC" | "SENDER_NAME" | "FULL" };
    }),

  setPreviewMode: authed
    .route({
      method: "POST",
      path: "/preview-mode",
      summary: "Set the current user's push preview mode",
      tags: ["Notifications"],
    })
    .input(setPreviewModeInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ context, input }) => {
      await db.user.update({
        where: { id: context.user.id },
        data: { pushPreviewMode: input.mode },
      });
      return { status: "ok", success: true };
    }),

  // SW periodicsync handler reads this to repaint the OS badge when
  // the PWA hasn't received a push (e.g. operator's laptop has been
  // closed for a few hours). Returns the same org-wide unread count
  // we compute in the WhatsApp webhook so badge math is consistent.
  unreadCount: authed
    .route({
      method: "GET",
      path: "/unread-count",
      summary: "Org-wide WhatsApp unread count for the PWA badge",
      tags: ["Notifications"],
    })
    .output(unreadCountResponseSchema)
    .handler(async () => {
      const agg = await db.waConversation.aggregate({
        _sum: { unreadCount: true },
        where: { unreadCount: { gt: 0 } },
      });
      return { count: Number(agg._sum.unreadCount ?? 0) };
    }),

  // Unauthenticated: SW background fetches don't always carry cookies
  // (Safari iOS strips them when renewing a subscription). The
  // oldEndpoint acts as proof-of-possession instead — see
  // services/notifications.ts::rotatePushSubscription for rationale.
  rotate: base
    .route({
      method: "POST",
      path: "/rotate",
      summary: "Swap a rotated push subscription endpoint",
      tags: ["Notifications"],
    })
    .input(rotateInputSchema)
    .output(notificationsStatusResponseSchema)
    .handler(async ({ input }) => {
      const result = await rotatePushSubscription(input.oldEndpoint, input.subscription);
      if (!result.success) {
        return { status: "not-found", message: result.reason, success: false };
      }
      return { status: "ok", message: "Rotated successfully", success: true };
    }),
};

export const notificationsORPCRouter = base
  .prefix("/api/orpc/notifications")
  .router(notificationsORPCRouterBase);

export const notificationsORPCHandler = new SuperJSONRPCHandler(notificationsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.notifications",
      });
    }),
  ],
});

export const notificationsOpenAPIHandler = new OpenAPIHandler(notificationsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Notifications oRPC",
          description: "Contratos oRPC/OpenAPI para push notifications.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.notifications",
      });
    }),
  ],
});

export type NotificationsORPCRouter = typeof notificationsORPCRouter;
