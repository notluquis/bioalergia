import { db } from "@finanzas/db";

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
    throw new Error("Carrito vacío");
  }

  const subtotal = cart.items.reduce((acc, i) => acc + i.unitPriceClp * i.qty, 0);
  const total = subtotal + input.shippingClp;

  return await db.order.create({
    data: {
      number: generateOrderNumber(),
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
        create: cart.items.map((it) => ({
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

export async function attachDteToOrder(
  orderId: number,
  dte: { folio: string; type: string }
) {
  await db.order.update({
    where: { id: orderId },
    data: { dteFolio: dte.folio, dteType: dte.type },
  });
}

export async function getOrderByNumber(number: string, email: string) {
  const order = await db.order.findUnique({
    where: { number },
    include: { items: true, payments: true },
  });
  if (!order || order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    return null;
  }
  return order;
}
