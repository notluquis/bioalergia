import { db } from "@finanzas/db";
import type {
  accountMyOrderByNumberInputSchema,
  accountMyOrdersInputSchema,
  accountRepurchaseResponseSchema,
  accountUpsertAddressInputSchema,
} from "@finanzas/orpc-contracts/account";
import type { z } from "zod";

import { DomainError } from "../lib/errors.ts";
import { addItemToCart } from "./cart.ts";

// Lógica de negocio de la cuenta de cliente del shop (bioalergia.cl), fuera de
// los handlers oRPC. Los servicios hacen queries/validaciones y lanzan
// DomainError (mapeado a HTTP por orpc/error.ts::toORPCError vía el
// SuperJSONRPCHandler); los handlers quedan finos. La sesión del SITE
// (getSiteSessionUser) y la orquestación de cookies del carrito SIGUEN en el
// handler: acá solo entra el `userId` ya resuelto.
//
// SEGURIDAD: cada query está scopeada al `userId` del cliente logueado. Es un
// boundary de seguridad — un cliente sólo puede ver/mutar su propia data. El
// `userId` se recibe como parámetro y se aplica idéntico al código original.

type MyOrdersPayload = z.infer<typeof accountMyOrdersInputSchema>;
type MyOrderByNumberPayload = z.infer<typeof accountMyOrderByNumberInputSchema>;
type UpsertAddressPayload = z.infer<typeof accountUpsertAddressInputSchema>;
type RepurchaseResponseData = z.infer<typeof accountRepurchaseResponseSchema>["data"];

type AddressRow = Awaited<ReturnType<typeof db.address.findFirst>>;

// Mapper de fila Address → forma de respuesta (snake_case del contrato).
// Mantenido en el service porque varias funciones lo reutilizan.
export function serializeAddress(row: NonNullable<AddressRow>) {
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

export async function getPersonIdForUser(userId: number): Promise<number | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { personId: true },
  });
  return user?.personId ?? null;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function listMyOrders(userId: number, input: MyOrdersPayload) {
  const limit = input.limit + 1;
  const orders = await db.order.findMany({
    where: {
      userId,
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
    next_cursor: hasMore ? sliced[sliced.length - 1].id : null,
  };
}

export async function getMyOrderByNumber(userId: number, input: MyOrderByNumberPayload) {
  const order = await db.order.findUnique({
    where: { number: input.number },
    include: { items: true, payments: true },
  });
  // Scoping de seguridad: aunque la query es por `number`, exigimos que el
  // pedido pertenezca al cliente logueado, si no → NOT_FOUND (no se filtra
  // existencia de pedidos ajenos).
  if (!order || order.userId !== userId) {
    throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  }
  type ItemRow = (typeof order.items)[number];
  type PaymentRow = (typeof order.payments)[number];
  return {
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
      cx_ot_number: order.cxOtNumber,
      dte_pdf_url: order.dtePdfUrl,
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
}

// ─── Addresses ──────────────────────────────────────────────────────────────

export async function listMyAddresses(userId: number) {
  const rows = await db.address.findMany({
    where: { userId, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { id: "desc" }],
  });
  return {
    data: rows.map((row: (typeof rows)[number]) => serializeAddress(row)),
  };
}

// Devuelve la dirección serializada. Lanza BAD_REQUEST equivalente al INTERNAL
// original NO acá — el chequeo de persona vinculada queda en el handler como
// un Error 500 (no hay kind INTERNAL en DomainError). Acá `personId` ya viene
// resuelto y validado por el handler.
export async function upsertMyAddress(
  userId: number,
  personId: number,
  input: UpsertAddressPayload
) {
  if (input.isPrimary) {
    // Demote any other primary for this user so the new one wins.
    await db.address.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  if (input.id) {
    const existing = await db.address.findUnique({ where: { id: input.id } });
    // Scoping de seguridad: la dirección debe pertenecer al cliente logueado.
    if (!existing || existing.userId !== userId) {
      throw new DomainError("NOT_FOUND", "Dirección no encontrada");
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
    return { data: serializeAddress(updated) };
  }
  const created = await db.address.create({
    data: {
      personId,
      userId,
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
  return { data: serializeAddress(created) };
}

export async function deleteMyAddress(userId: number, addressId: number): Promise<void> {
  const existing = await db.address.findUnique({ where: { id: addressId } });
  // Scoping de seguridad: la dirección debe pertenecer al cliente logueado.
  if (!existing || existing.userId !== userId) {
    throw new DomainError("NOT_FOUND", "Dirección no encontrada");
  }
  // Soft-delete via isActive=false to preserve historical order references.
  await db.address.update({
    where: { id: addressId },
    data: { isActive: false, isPrimary: false },
  });
}

// ─── Repurchase ───────────────────────────────────────────────────────────────

// Carga el pedido del cliente (scopeado a `userId`) con sus items + producto.
// Lanza NOT_FOUND si no existe o no es del cliente. La orquestación de
// cookies/carrito (getCookie/setCookie, generateCartToken, buildCartCookie)
// queda en el handler porque depende del Hono context; acá sólo se necesita
// el pedido + sus items para decidir qué se agrega.
export async function getRepurchaseOrder(userId: number, orderNumber: string) {
  const order = await db.order.findUnique({
    where: { number: orderNumber },
    include: { items: { include: { product: true } } },
  });
  // Scoping de seguridad: el pedido debe pertenecer al cliente logueado.
  if (!order || order.userId !== userId) {
    throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  }
  return order;
}

// Asegura que el carrito quede vinculado al cliente cuando estaba huérfano.
// (El handler ya resolvió/creó el carrito vía cookies.)
export async function linkCartToUser(cartId: number, userId: number): Promise<void> {
  await db.cart.update({ where: { id: cartId }, data: { userId } });
}

// Recorre los items del pedido y los agrega al carrito, saltando los
// descontinuados / sin stock. Devuelve el conteo agregado + los saltados,
// idéntico a la lógica original del handler.
export async function repurchaseOrderItems(
  cartId: number,
  order: Awaited<ReturnType<typeof getRepurchaseOrder>>
): Promise<RepurchaseResponseData> {
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
        cartId,
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
  return { items_added: added, items_skipped_oos: skipped };
}
