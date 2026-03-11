import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  sendPushNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from "../services/notifications";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type NotificationsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<NotificationsORPCContext>();

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
});

const statusResponseSchema = z.object({
  message: z.string().optional(),
  sent: z.number().optional(),
  status: z.string().optional(),
  success: z.boolean().optional(),
});

const subscribeInputSchema = z.object({
  subscription: pushSubscriptionSchema,
  userId: z.number().int().optional(),
});

const unsubscribeInputSchema = z.object({
  endpoint: z.string().url(),
});

const sendTestInputSchema = z.object({
  userId: z.number().int().optional(),
});

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
  const canRead = await hasPermission(context.user.id, "read", "Notification");

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
      summary: "Send a test push notification to current user",
      tags: ["Notifications"],
    })
    .input(sendTestInputSchema)
    .output(statusResponseSchema)
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
      summary: "Subscribe current user to push notifications",
      tags: ["Notifications"],
    })
    .input(subscribeInputSchema)
    .output(statusResponseSchema)
    .handler(async ({ context, input }) => {
      await subscribeToPush(context.user.id, input.subscription);
      return { message: "Subscribed successfully", status: "ok" };
    }),

  unsubscribe: authed
    .route({
      method: "POST",
      path: "/unsubscribe",
      summary: "Unsubscribe current user from push notifications",
      tags: ["Notifications"],
    })
    .input(unsubscribeInputSchema)
    .output(statusResponseSchema)
    .handler(async ({ context, input }) => {
      await unsubscribeFromPush(context.user.id, input.endpoint);
      return { message: "Unsubscribed successfully", status: "ok" };
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
