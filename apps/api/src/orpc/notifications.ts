import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  notificationsStatusResponseSchema,
  sendTestInputSchema,
  subscribeInputSchema,
  unsubscribeInputSchema,
} from "@finanzas/orpc-contracts/notifications";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
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
