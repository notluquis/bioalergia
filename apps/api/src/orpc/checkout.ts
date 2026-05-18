import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  checkoutStartInputSchema,
  checkoutStartResponseSchema,
  checkoutStatusInputSchema,
  checkoutStatusResponseSchema,
} from "@finanzas/orpc-contracts/checkout";
import { db } from "@finanzas/db";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";

import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { createCheckoutPreference } from "../modules/mercadopago-checkout/payment.ts";
import { reserveStockForOrder } from "../modules/reservations/index.ts";
import { createOrderFromCart, getOrderByNumber } from "../services/orders.ts";

type OrderWithItems = Awaited<ReturnType<typeof createOrderFromCart>>;
import { CART_COOKIE_NAME, findCartByToken } from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CheckoutORPCContext = { hono: HonoContext };
const base = os.$context<CheckoutORPCContext>();

const startRoute = base
  .route({ method: "POST", path: "/start", summary: "Start checkout", tags: ["Checkout"] })
  .input(checkoutStartInputSchema)
  .output(checkoutStartResponseSchema)
  .handler(async ({ input, context }) => {
    const token = getCookie(context.hono, CART_COOKIE_NAME);
    if (!token) throw new ORPCError("BAD_REQUEST", { message: "Sin carrito" });
    const cart = await findCartByToken(token);
    if (!cart || cart.items.length === 0) {
      throw new ORPCError("BAD_REQUEST", { message: "Carrito vacío" });
    }

    // Shipping: pickup = 0; Chilexpress = TODO (cotizar)
    const shippingClp = input.shipping.method === "pickup" ? 0 : 0;

    const order = await createOrderFromCart({
      cartId: cart.id,
      customerEmail: input.customer.email,
      customerName: input.customer.name,
      customerRut: input.customer.rut ?? null,
      customerPhone: input.customer.phone ?? null,
      billingType: input.billing_type,
      shippingClp,
      shippingAddress:
        input.shipping.method === "chilexpress" ? input.shipping.address : null,
      notes: input.notes ?? null,
    });

    // Reservar stock — falla aquí cancela el flujo antes de tocar MP.
    type OrderItem = OrderWithItems["items"][number];
    await reserveStockForOrder({
      orderId: order.id,
      items: order.items.map((i: OrderItem) => ({
        productId: i.productId,
        qty: i.qty,
      })),
    });

    const preference = await createCheckoutPreference({
      orderNumber: order.number,
      orderId: order.id,
      customerEmail: input.customer.email,
      items: order.items.map((i: OrderItem) => ({
        sku: i.product.sku,
        title: i.product.name,
        qty: i.qty,
        unitPriceClp: i.unitPriceClp,
      })),
    });

    // Persist payment row con idempotencyKey usado en MP.
    await db.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADO_PAGO",
        idempotencyKey: preference.idempotencyKey,
        amountClp: order.totalClp,
        status: "PENDING",
      },
    });

    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY ?? "";

    return {
      data: {
        order_id: order.id,
        order_number: order.number,
        mp_preference_id: preference.preferenceId,
        mp_public_key: publicKey,
        total_clp: order.totalClp,
      },
      status: "ok" as const,
    };
  });

const statusRoute = base
  .route({ method: "POST", path: "/status", summary: "Order status", tags: ["Checkout"] })
  .input(checkoutStatusInputSchema)
  .output(checkoutStatusResponseSchema)
  .handler(async ({ input }) => {
    const order = await getOrderByNumber(input.order_number, input.email);
    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido no encontrado" });
    }
    return {
      data: {
        order_number: order.number,
        status: order.status,
        total_clp: order.totalClp,
        dte_folio: order.dteFolio,
        dte_type: order.dteType,
      },
      status: "ok" as const,
    };
  });

const checkoutORPCRouterBase = {
  start: startRoute,
  status: statusRoute,
};

export const checkoutORPCRouter = base
  .prefix("/api/orpc/checkout")
  .tag("Checkout")
  .router(checkoutORPCRouterBase);

export const checkoutORPCHandler = new SuperJSONRPCHandler(checkoutORPCRouter, {
  interceptors: [onError((error) => logError("checkout.orpc.rpc", error, {}))],
});

export const checkoutOpenAPIHandler = new OpenAPIHandler(checkoutORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Checkout API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia Checkout API", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("checkout.orpc.openapi", error, {}))],
});

export type CheckoutORPCRouter = typeof checkoutORPCRouter;
