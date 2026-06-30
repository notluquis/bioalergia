import { db } from "@finanzas/db";
import { randomUUID } from "node:crypto";
import { DomainError } from "../lib/errors.ts";

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase();
  return `BIO-${year}-${rnd}`;
}

export type CreateOrderInput = {
  cartId: number;
  customerEmail: string;
  customerName: string;
  customerRut?: string | null;
  customerPhone?: string | null;
  billingType: "BOLETA" | "FACTURA";
  shippingClp: number;
  shippingAddress?: unknown;
  notes?: string | null;
};

export type OrderWithItems = Awaited<ReturnType<typeof createOrderFromCart>>;

export async function createOrderFromCart(input: CreateOrderInput) {
  const cart = await db.cart.findUnique({
    where: { id: input.cartId },
    include: {
      items: { include: { product: true } },
    },
  });
  if (!cart || cart.items.length === 0) {
    throw new DomainError("BAD_REQUEST", "Carrito vacío");
  }

  type CartItem = (typeof cart.items)[number];
  const subtotal = cart.items.reduce((acc: number, i: CartItem) => acc + i.unitPriceClp * i.qty, 0);
  const total = subtotal + input.shippingClp;

  return await db.order.create({
    data: {
      number: generateOrderNumber(),
      accessToken: randomUUID(),
      cartId: cart.id,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerRut: input.customerRut ?? null,
      customerPhone: input.customerPhone ?? null,
      billingType: input.billingType,
      shippingAddress: (input.shippingAddress ?? null) as never,
      subtotalClp: subtotal,
      shippingClp: input.shippingClp,
      discountClp: 0,
      totalClp: total,
      status: "PENDING",
      channel: "WEB",
      notes: input.notes ?? null,
      items: {
        create: cart.items.map((it: CartItem) => ({
          productId: it.productId,
          productSnapshot: {
            sku: it.product.sku,
            name: it.product.name,
            slug: it.product.slug,
          } as never,
          qty: it.qty,
          unitPriceClp: it.unitPriceClp,
          lineTotalClp: it.unitPriceClp * it.qty,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });
}

export async function markOrderPaid(orderId: number) {
  await db.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
  });
}

export async function attachDteToOrder(orderId: number, dte: { folio: string; type: string }) {
  await db.order.update({
    where: { id: orderId },
    data: { dteFolio: dte.folio, dteType: dte.type },
  });
}

export async function getOrderByNumber(
  number: string,
  lookup: { token?: string; email?: string }
) {
  const order = await db.order.findUnique({
    where: { number },
    include: { items: true, payments: true },
  });
  if (!order) return null;
  // Prefer the opaque token (no PII in the URL); fall back to the email match
  // for links issued before the token existed.
  if (lookup.token) {
    return order.accessToken && order.accessToken === lookup.token ? order : null;
  }
  if (lookup.email && order.customerEmail.toLowerCase() === lookup.email.toLowerCase()) {
    return order;
  }
  return null;
}
