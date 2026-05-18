import { db } from "@finanzas/db";
import {
  accountDeleteAddressInputSchema,
  accountMyAddressesResponseSchema,
  accountMyOrderByNumberInputSchema,
  accountMyOrderByNumberResponseSchema,
  accountMyOrdersInputSchema,
  accountMyOrdersResponseSchema,
  accountRepurchaseInputSchema,
  accountRepurchaseResponseSchema,
  accountStatusResponseSchema,
  accountUpsertAddressInputSchema,
  accountUpsertAddressResponseSchema,
} from "@finanzas/orpc-contracts/account";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import { getSiteSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  addItemToCart,
  buildCartCookie,
  CART_COOKIE_NAME,
  createCartWithToken,
  findCartByToken,
  generateCartToken,
} from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type AccountContext = { hono: HonoContext };
const base = os.$context<AccountContext>();

async function requireSession(hono: HonoContext) {
  const session = await getSiteSessionUser(hono);
  if (!session) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return session;
}

async function getPersonIdForUser(userId: number): Promise<number | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { personId: true },
  });
  return user?.personId ?? null;
}

type AddressRow = Awaited<ReturnType<typeof db.address.findFirst>>;

function serializeAddress(row: NonNullable<AddressRow>) {
  return {
    id: row.id,
    label: row.label,
    street: row.street,
    number: row.number,
    supplement: row.supplement,
    reference: row.reference,
    postal_code: row.postalCode,
    comuna: row.comuna,
    region: row.region,
    is_primary: row.isPrimary,
  };
}

const myOrdersRoute = base
  .route({ method: "POST", path: "/orders", tags: ["Account"] })
  .input(accountMyOrdersInputSchema)
  .output(accountMyOrdersResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const limit = input.limit + 1;
    const orders = await db.order.findMany({
      where: {
        userId: session.id,
        ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit,
      include: { items: { select: { id: true } } },
    });
    const hasMore = orders.length > input.limit;
    const sliced = hasMore ? orders.slice(0, input.limit) : orders;
    type OrderRow = (typeof orders)[number];
    return {
      status: "ok" as const,
      data: sliced.map((o: OrderRow) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        channel: o.channel,
        total_clp: o.totalClp,
        subtotal_clp: o.subtotalClp,
        shipping_clp: o.shippingClp,
        discount_clp: o.discountClp,
        dte_folio: o.dteFolio,
        dte_type: o.dteType,
        created_at: o.createdAt.toISOString(),
        item_count: o.items.length,
      })),
      next_cursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  });

const myOrderByNumberRoute = base
  .route({ method: "POST", path: "/orders/by-number", tags: ["Account"] })
  .input(accountMyOrderByNumberInputSchema)
  .output(accountMyOrderByNumberResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const order = await db.order.findUnique({
      where: { number: input.number },
      include: { items: true, payments: true },
    });
    if (!order || order.userId !== session.id) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido no encontrado" });
    }
    type ItemRow = (typeof order.items)[number];
    type PaymentRow = (typeof order.payments)[number];
    return {
      status: "ok" as const,
      data: {
        id: order.id,
        number: order.number,
        status: order.status,
        channel: order.channel,
        total_clp: order.totalClp,
        subtotal_clp: order.subtotalClp,
        shipping_clp: order.shippingClp,
        discount_clp: order.discountClp,
        dte_folio: order.dteFolio,
        dte_type: order.dteType,
        created_at: order.createdAt.toISOString(),
        item_count: order.items.length,
        customer_email: order.customerEmail,
        customer_name: order.customerName,
        shipping_address: order.shippingAddress as unknown,
        items: order.items.map((i: ItemRow) => ({
          id: i.id,
          product_id: i.productId,
          qty: i.qty,
          unit_price_clp: i.unitPriceClp,
          line_total_clp: i.lineTotalClp,
          product_snapshot: i.productSnapshot as unknown,
        })),
        payments: order.payments.map((p: PaymentRow) => ({
          id: p.id,
          provider: p.provider,
          status: p.status,
          amount_clp: p.amountClp,
          created_at: p.createdAt.toISOString(),
        })),
      },
    };
  });

const myAddressesRoute = base
  .route({ method: "GET", path: "/addresses", tags: ["Account"] })
  .output(accountMyAddressesResponseSchema)
  .handler(async ({ context }) => {
    const session = await requireSession(context.hono);
    const rows = await db.address.findMany({
      where: { userId: session.id, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { id: "desc" }],
    });
    return {
      status: "ok" as const,
      data: rows.map((row: (typeof rows)[number]) => serializeAddress(row)),
    };
  });

const upsertAddressRoute = base
  .route({ method: "POST", path: "/addresses/upsert", tags: ["Account"] })
  .input(accountUpsertAddressInputSchema)
  .output(accountUpsertAddressResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const personId = await getPersonIdForUser(session.id);
    if (!personId) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Cuenta sin persona vinculada" });
    }
    if (input.isPrimary) {
      // Demote any other primary for this user so the new one wins.
      await db.address.updateMany({
        where: { userId: session.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    if (input.id) {
      const existing = await db.address.findUnique({ where: { id: input.id } });
      if (!existing || existing.userId !== session.id) {
        throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
      }
      const updated = await db.address.update({
        where: { id: input.id },
        data: {
          label: input.label,
          street: input.street,
          number: input.number,
          supplement: input.supplement ?? null,
          reference: input.reference ?? null,
          postalCode: input.postalCode ?? null,
          comuna: input.comuna,
          region: input.region,
          isPrimary: input.isPrimary,
        },
      });
      return { status: "ok" as const, data: serializeAddress(updated) };
    }
    const created = await db.address.create({
      data: {
        personId,
        userId: session.id,
        label: input.label,
        street: input.street,
        number: input.number,
        ...(input.supplement ? { supplement: input.supplement } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
        ...(input.postalCode ? { postalCode: input.postalCode } : {}),
        comuna: input.comuna,
        region: input.region,
        isPrimary: input.isPrimary,
      },
    });
    return { status: "ok" as const, data: serializeAddress(created) };
  });

const deleteAddressRoute = base
  .route({ method: "POST", path: "/addresses/delete", tags: ["Account"] })
  .input(accountDeleteAddressInputSchema)
  .output(accountStatusResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const existing = await db.address.findUnique({ where: { id: input.id } });
    if (!existing || existing.userId !== session.id) {
      throw new ORPCError("NOT_FOUND", { message: "Dirección no encontrada" });
    }
    // Soft-delete via isActive=false to preserve historical order references.
    await db.address.update({
      where: { id: input.id },
      data: { isActive: false, isPrimary: false },
    });
    return { status: "ok" as const };
  });

const repurchaseRoute = base
  .route({ method: "POST", path: "/repurchase", tags: ["Account"] })
  .input(accountRepurchaseInputSchema)
  .output(accountRepurchaseResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const order = await db.order.findUnique({
      where: { number: input.orderNumber },
      include: { items: { include: { product: true } } },
    });
    if (!order || order.userId !== session.id) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido no encontrado" });
    }
    // Ensure user has a cart (linked to the session). Create one if missing.
    let cartToken = getCookie(context.hono, CART_COOKIE_NAME);
    let cart = cartToken ? await findCartByToken(cartToken) : null;
    if (!cart) {
      const { token, hash } = generateCartToken();
      cart = await createCartWithToken(hash, session.id);
      cartToken = token;
      const cookie = buildCartCookie(token, process.env.NODE_ENV === "production");
      setCookie(context.hono, cookie.name, cookie.value, {
        maxAge: cookie.maxAge,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: "Lax",
      });
    } else if (cart.userId === null) {
      await db.cart.update({ where: { id: cart.id }, data: { userId: session.id } });
    }

    type OrderItem = (typeof order.items)[number];
    const skipped: Array<{ product_id: number; name: string; reason: string }> = [];
    let added = 0;
    for (const item of order.items as OrderItem[]) {
      if (item.product.status !== "ACTIVE") {
        skipped.push({
          product_id: item.productId,
          name: item.product.name,
          reason: "Producto descontinuado",
        });
        continue;
      }
      const sellable = item.product.availableQty - item.product.safetyStock;
      if (sellable <= 0) {
        skipped.push({
          product_id: item.productId,
          name: item.product.name,
          reason: "Sin stock",
        });
        continue;
      }
      try {
        await addItemToCart({
          cartId: cart.id,
          productId: item.productId,
          qty: Math.min(item.qty, sellable),
        });
        added += 1;
      } catch (err) {
        skipped.push({
          product_id: item.productId,
          name: item.product.name,
          reason: err instanceof Error ? err.message : "Error al agregar",
        });
      }
    }
    return {
      status: "ok" as const,
      data: { items_added: added, items_skipped_oos: skipped },
    };
  });

const accountRouterBase = {
  myOrders: myOrdersRoute,
  myOrderByNumber: myOrderByNumberRoute,
  myAddresses: myAddressesRoute,
  upsertAddress: upsertAddressRoute,
  deleteAddress: deleteAddressRoute,
  repurchase: repurchaseRoute,
};

export const accountORPCRouter = base
  .prefix("/api/orpc/account")
  .tag("Account")
  .router(accountRouterBase);

export const accountORPCHandler = new SuperJSONRPCHandler(accountORPCRouter, {
  interceptors: [onError((error) => logError("account.orpc.rpc", error, {}))],
});

export type AccountORPCRouter = typeof accountORPCRouter;
