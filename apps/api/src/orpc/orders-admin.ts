import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  orderDetailResponseSchema,
  orderIdInputSchema,
  ordersListInputSchema,
  ordersListResponseSchema,
  updateShippingAddressInputSchema,
} from "@finanzas/orpc-contracts/orders-admin";
import type { OrdersAdminContract } from "@finanzas/orpc-contracts/orders-admin";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";

import { logAuditFromContext } from "../lib/audit-log.ts";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { refreshOrderTrackingIfStale } from "../services/order-tracking.ts";
import {
  cancelOrder,
  getOrderById,
  listOrders,
  markOrderFulfilled,
  refundOrder,
  updateOrderShippingAddress,
} from "../services/orders-admin.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type OrdersAdminORPCContext = { hono: HonoContext };
const base = os.$context<OrdersAdminORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const requireRead = authed.use(async ({ context, next }) => {
  if (!(await hasPermission(context.user, "read", "ShopOrder"))) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const requireWrite = authed.use(async ({ context, next }) => {
  if (!(await hasPermission(context.user, "update", "ShopOrder"))) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const listRoute = requireRead
  .route({ method: "GET", path: "/orders", summary: "List shop orders", tags: ["Orders"] })
  .input(ordersListInputSchema)
  .output(ordersListResponseSchema)
  .handler(async ({ input }) => {
    const { orders, nextCursor } = await listOrders(input);
    return { data: { orders, next_cursor: nextCursor }, status: "ok" as const };
  });

const detailRoute = requireRead
  .route({ method: "GET", path: "/orders/detail", summary: "Order detail", tags: ["Orders"] })
  .input(orderIdInputSchema)
  .output(orderDetailResponseSchema)
  .handler(async ({ input }) => {
    // Lazy on-view tracking refresh (W3-C): refresh Chilexpress status when an
    // admin opens a shipped order's detail (best-effort, throttled per-order).
    await refreshOrderTrackingIfStale(input.id);
    return { data: await getOrderById(input.id), status: "ok" as const };
  });

const markFulfilledRoute = requireWrite
  .route({
    method: "POST",
    path: "/orders/fulfill",
    summary: "Mark order dispatched",
    tags: ["Orders"],
  })
  .input(orderIdInputSchema)
  .output(orderDetailResponseSchema)
  .handler(async ({ input, context }) => {
    const order = await markOrderFulfilled(input.id);
    await logAuditFromContext(context.hono, {
      kind: "DATA_UPDATE",
      userId: context.user.id,
      actorLabel: context.user.email,
      resource: "order",
      resourceId: order.id,
      outcome: "ok",
      message: `Pedido ${order.number} marcado como despachado`,
      metadata: { number: order.number, status: "FULFILLED" },
    });
    return { data: order, status: "ok" as const };
  });

const cancelRoute = requireWrite
  .route({ method: "POST", path: "/orders/cancel", summary: "Cancel an unpaid order", tags: ["Orders"] })
  .input(orderIdInputSchema)
  .output(orderDetailResponseSchema)
  .handler(async ({ input, context }) => {
    const order = await cancelOrder(input.id);
    await logAuditFromContext(context.hono, {
      kind: "DATA_UPDATE",
      userId: context.user.id,
      actorLabel: context.user.email,
      resource: "order",
      resourceId: order.id,
      outcome: "ok",
      message: `Pedido ${order.number} cancelado`,
      metadata: { number: order.number, status: "CANCELLED" },
    });
    return { data: order, status: "ok" as const };
  });

const refundRoute = requireWrite
  .route({ method: "POST", path: "/orders/refund", summary: "Refund a paid order", tags: ["Orders"] })
  .input(orderIdInputSchema)
  .output(orderDetailResponseSchema)
  .handler(async ({ input, context }) => {
    const order = await refundOrder(input.id);
    await logAuditFromContext(context.hono, {
      kind: "FINANCIAL_CHANGE",
      userId: context.user.id,
      actorLabel: context.user.email,
      resource: "order",
      resourceId: order.id,
      outcome: "ok",
      message: `Pedido ${order.number} reembolsado (${order.total_clp} CLP)`,
      metadata: { number: order.number, status: "REFUNDED", totalClp: order.total_clp },
    });
    return { data: order, status: "ok" as const };
  });

const updateShippingAddressRoute = requireWrite
  .route({
    method: "POST",
    path: "/orders/shipping-address",
    summary: "Edit shipping address (PENDING/PAID)",
    tags: ["Orders"],
  })
  .input(updateShippingAddressInputSchema)
  .output(orderDetailResponseSchema)
  .handler(async ({ input, context }) => {
    const order = await updateOrderShippingAddress(input.id, input.address);
    await logAuditFromContext(context.hono, {
      kind: "DATA_UPDATE",
      userId: context.user.id,
      actorLabel: context.user.email,
      resource: "order",
      resourceId: order.id,
      outcome: "ok",
      message: `Pedido ${order.number}: dirección de despacho editada`,
      metadata: { number: order.number, cxOtNumber: order.cx_ot_number },
    });
    return { data: order, status: "ok" as const };
  });

const ordersAdminORPCRouterBase = {
  list: listRoute,
  detail: detailRoute,
  markFulfilled: markFulfilledRoute,
  cancel: cancelRoute,
  refund: refundRoute,
  updateShippingAddress: updateShippingAddressRoute,
} satisfies Record<keyof OrdersAdminContract, unknown>;

export const ordersAdminORPCRouter = base
  .prefix("/api/orpc/orders-admin")
  .tag("Orders")
  .router(ordersAdminORPCRouterBase);

export const ordersAdminORPCHandler = new SuperJSONRPCHandler(ordersAdminORPCRouter, {
  interceptors: [onError((error) => logError("orders-admin.orpc.rpc", error, {}))],
});

export const ordersAdminOpenAPIHandler = new OpenAPIHandler(ordersAdminORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Orders API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia Orders API", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("orders-admin.orpc.openapi", error, {}))],
});

export type OrdersAdminORPCRouter = typeof ordersAdminORPCRouter;
