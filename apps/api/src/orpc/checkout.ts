import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  checkoutCommunesResponseSchema,
  checkoutQuoteInputSchema,
  checkoutQuoteResponseSchema,
  checkoutStartInputSchema,
  checkoutStartResponseSchema,
  checkoutStatusInputSchema,
  checkoutStatusResponseSchema,
  checkoutStreetNumbersInputSchema,
  checkoutStreetNumbersResponseSchema,
  checkoutStreetsInputSchema,
  checkoutStreetsResponseSchema,
} from "@finanzas/orpc-contracts/checkout";
import { db } from "@finanzas/db";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";
import { randomUUID } from "node:crypto";

import { chilexpressConfig } from "../lib/config.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { getCommunes, getRegions, quoteCourier } from "../modules/chilexpress/client.ts";
import { createCheckoutPreference } from "../modules/mercadopago-checkout/payment.ts";
import { reserveStockForOrder } from "../modules/reservations/index.ts";
import { createOrderFromCart, getOrderByNumber } from "../services/orders.ts";
import { fetchStreetNumbers, fetchStreets } from "../services/shipments.ts";

type OrderWithItems = Awaited<ReturnType<typeof createOrderFromCart>>;
import { CART_COOKIE_NAME, findCartByToken } from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CheckoutORPCContext = { hono: HonoContext };
const base = os.$context<CheckoutORPCContext>();

// Chilexpress comuna list (name → coverage code + region), so the checkout shows
// a real "pick your comuna" selector instead of asking for the coverage code.
// Communes change ~never; cache the flattened list for the process lifetime.
// ponytail: in-memory cache, lost on deploy and rebuilt on first hit. A shared
// cache (Redis) is the upgrade only if cold-start latency on one request matters.
let communesCache: Array<{ code: string; name: string; region: string }> | null = null;
async function loadCommunes() {
  if (communesCache) return communesCache;
  const cfg = chilexpressConfig;
  if (!cfg) return [];
  const regions = await getRegions(cfg);
  const nameByRegion = new Map(regions.map((r) => [r.regionId, r.regionName]));
  const perRegion = await Promise.all(
    regions.map((r) => getCommunes(cfg, r.regionId).catch(() => []))
  );
  const all = perRegion.flat().map((c) => ({
    code: c.countyCode,
    name: c.countyName,
    region: nameByRegion.get(c.regionCode) ?? "",
  }));
  all.sort((a, b) => a.name.localeCompare(b.name, "es"));
  communesCache = all;
  return all;
}

const communesRoute = base
  .route({ method: "GET", path: "/communes", summary: "Chilexpress communes", tags: ["Checkout"] })
  .output(checkoutCommunesResponseSchema)
  .handler(async () => {
    return { data: { communes: await loadCommunes() }, status: "ok" as const };
  });

// Public Chilexpress street lookup (reuses the shipments service — the same
// validated cascade the intranet wizard uses) so the storefront can capture a
// real street + number, not free text.
const streetsRoute = base
  .route({ method: "GET", path: "/streets", summary: "Chilexpress streets", tags: ["Checkout"] })
  .input(checkoutStreetsInputSchema)
  .output(checkoutStreetsResponseSchema)
  .handler(async ({ input }) => {
    const streets = await fetchStreets({ countyName: input.county_name, query: input.query });
    return {
      data: {
        streets: streets.map((s) => ({ street_id: s.streetId, street_name: s.streetName })),
      },
      status: "ok" as const,
    };
  });

const streetNumbersRoute = base
  .route({
    method: "GET",
    path: "/street-numbers",
    summary: "Chilexpress street numbers",
    tags: ["Checkout"],
  })
  .input(checkoutStreetNumbersInputSchema)
  .output(checkoutStreetNumbersResponseSchema)
  .handler(async ({ input }) => {
    const numbers = await fetchStreetNumbers(input.street_name_id);
    return {
      data: { numbers: numbers.map((n) => ({ number: n.number, address_id: n.addressId })) },
      status: "ok" as const,
    };
  });

type CheckoutCart = NonNullable<Awaited<ReturnType<typeof findCartByToken>>>;

// Shared by /quote and /start: the server is the single source of the shipping
// fee, so /start re-quotes (never trusts a client amount) before charging.
async function quoteShippingOptions(cart: CheckoutCart, destinationCountyCode: string) {
  if (!chilexpressConfig) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Chilexpress no configurado" });
  }
  type CartLine = CheckoutCart["items"][number];
  const totalGrams = cart.items.reduce(
    (acc: number, i: CartLine) => acc + (i.product.weightGrams ?? 250) * i.qty,
    0
  );
  const totalKg = Math.max(0.1, totalGrams / 1000);
  const declaredWorth = cart.items.reduce(
    (acc: number, i: CartLine) => acc + i.unitPriceClp * i.qty,
    0
  );

  const res = await quoteCourier(chilexpressConfig, {
    originCountyCode: chilexpressConfig.originCoverageCode,
    destinationCountyCode,
    package: { weight: totalKg, height: 10, width: 20, length: 30 },
    productType: 3,
    contentType: 1,
    declaredWorth: String(declaredWorth),
    deliveryTime: 2,
  });

  return (
    res.data?.courierServiceOptions?.map((o) => ({
      service_code: String(o.serviceTypeCode),
      service_description: o.serviceDescription,
      shipping_clp: Math.round(Number(o.serviceValue)),
      delivery_time_days: o.deliveryTime ?? null,
    })) ?? []
  );
}

const quoteRoute = base
  .route({
    method: "POST",
    path: "/quote",
    summary: "Chilexpress shipping quote",
    tags: ["Checkout"],
  })
  .input(checkoutQuoteInputSchema)
  .output(checkoutQuoteResponseSchema)
  .handler(async ({ input, context }) => {
    const token = getCookie(context.hono, CART_COOKIE_NAME);
    if (!token) throw new ORPCError("BAD_REQUEST", { message: "Sin carrito" });
    const cart = await findCartByToken(token);
    if (!cart || cart.items.length === 0) {
      throw new ORPCError("BAD_REQUEST", { message: "Carrito vacío" });
    }
    const options = await quoteShippingOptions(cart, input.destination_county_code);
    return { data: { options }, status: "ok" as const };
  });

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

    // Shipping fee is computed server-side: re-quote Chilexpress and charge the
    // chosen service (fall back to the cheapest), so the amount can't be forged.
    let shippingClp = 0;
    let chosenServiceCode: string | undefined;
    if (input.shipping.method === "chilexpress") {
      // Capture the narrowed variant in a const: TS resets property-access
      // narrowing across the `await` below, widening `input.shipping` back.
      const ship = input.shipping;
      const options = await quoteShippingOptions(cart, ship.county_code);
      const chosen = options.find((o) => o.service_code === ship.service_code) ?? options[0];
      if (!chosen) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No hay servicio de envío disponible para la comuna seleccionada",
        });
      }
      shippingClp = chosen.shipping_clp;
      chosenServiceCode = chosen.service_code;
    }

    const order = await createOrderFromCart({
      cartId: cart.id,
      customerEmail: input.customer.email,
      customerName: input.customer.name,
      customerRut: input.customer.rut ?? null,
      customerPhone: input.customer.phone ?? null,
      billingType: input.billing_type,
      shippingClp,
      // Persist the chosen Chilexpress service code alongside the structured
      // address so the OT can be auto-created on payment without re-quoting.
      shippingAddress:
        input.shipping.method === "chilexpress"
          ? { ...input.shipping.address, service_code: chosenServiceCode }
          : null,
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

    // Checkout Pro: create the MP preference (hosted checkout, every method) and
    // a PENDING payment row the shared webhook updates once MP confirms.
    const { preferenceId, initPoint } = await createCheckoutPreference({
      orderId: order.id,
      orderNumber: order.number,
      customerEmail: input.customer.email,
      accessToken: order.accessToken,
      shippingClp,
      items: order.items.map((i: OrderItem) => ({
        sku: i.product.sku,
        title: i.product.name,
        qty: i.qty,
        unitPriceClp: i.unitPriceClp,
      })),
    });

    await db.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADO_PAGO",
        providerPaymentId: preferenceId,
        idempotencyKey: randomUUID(),
        amountClp: order.totalClp,
        status: "PENDING",
      },
    });

    return {
      data: {
        order_id: order.id,
        order_number: order.number,
        total_clp: order.totalClp,
        init_point: initPoint,
      },
      status: "ok" as const,
    };
  });

const statusRoute = base
  .route({ method: "POST", path: "/status", summary: "Order status", tags: ["Checkout"] })
  .input(checkoutStatusInputSchema)
  .output(checkoutStatusResponseSchema)
  .handler(async ({ input }) => {
    const order = await getOrderByNumber(input.order_number, {
      token: input.token,
      email: input.email,
    });
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
  communes: communesRoute,
  streets: streetsRoute,
  streetNumbers: streetNumbersRoute,
  quote: quoteRoute,
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
