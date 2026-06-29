// Admin shop-orders service. Thin oRPC handlers call these; business rules +
// DomainError live here (golden 2026). Read-only listing/detail + the
// operational FULFILLED transition (dispatch). The DTE is emitted automatically
// at payment (webhook) — fulfillment here is operational, not a DTE gate.

import { db } from "@finanzas/db";
import type { OrderDetail, OrderSummary } from "@finanzas/orpc-contracts/orders-admin";

import { DomainError } from "../lib/errors.ts";

type OrderStatus = OrderSummary["status"];
type BillingType = OrderSummary["billing_type"];

type OrderRow = Awaited<ReturnType<typeof db.order.findUnique>>;
type OrderWithItems = NonNullable<OrderRow> & {
  items: Array<{
    id: number;
    productId: number;
    productSnapshot: unknown;
    qty: number;
    unitPriceClp: number;
    lineTotalClp: number;
  }>;
};

function mapDetail(o: OrderWithItems): OrderDetail {
  return {
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    customer_rut: o.customerRut,
    customer_phone: o.customerPhone,
    billing_type: o.billingType as BillingType,
    total_clp: o.totalClp,
    subtotal_clp: o.subtotalClp,
    shipping_clp: o.shippingClp,
    shipping_address: o.shippingAddress ?? null,
    dte_folio: o.dteFolio,
    dte_type: o.dteType,
    notes: o.notes,
    item_count: o.items.length,
    created_at: o.createdAt,
    items: o.items.map((it: OrderWithItems["items"][number]) => {
      const snap = (it.productSnapshot ?? {}) as { sku?: string; name?: string };
      return {
        id: it.id,
        product_id: it.productId,
        product_name: snap.name ?? "—",
        product_sku: snap.sku ?? "—",
        qty: it.qty,
        unit_price_clp: it.unitPriceClp,
        line_total_clp: it.lineTotalClp,
      };
    }),
  };
}

export async function listOrders(params: {
  limit: number;
  cursor?: number;
  status?: OrderStatus;
  search?: string;
}): Promise<{ orders: OrderSummary[]; nextCursor: number | null }> {
  const and: Array<Record<string, unknown>> = [];
  if (params.status) and.push({ status: params.status });
  if (params.cursor) and.push({ id: { lt: params.cursor } });
  const q = params.search?.trim();
  if (q) {
    and.push({
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { customerName: { contains: q, mode: "insensitive" as const } },
        { customerEmail: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }

  const rows = await db.order.findMany({
    where: and.length > 0 ? { AND: and } : {},
    orderBy: { id: "desc" },
    take: params.limit + 1,
    include: { items: { select: { id: true } } },
  });

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const orders: OrderSummary[] = page.map((o: (typeof rows)[number]) => ({
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    billing_type: o.billingType as BillingType,
    total_clp: o.totalClp,
    dte_folio: o.dteFolio,
    dte_type: o.dteType,
    item_count: o.items.length,
    created_at: o.createdAt,
  }));
  const last = page.at(-1);
  return { orders, nextCursor: hasMore && last ? last.id : null };
}

export async function getOrderById(id: number): Promise<OrderDetail> {
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  return mapDetail(o as OrderWithItems);
}

export async function markOrderFulfilled(id: number): Promise<OrderDetail> {
  const existing = await db.order.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  if (existing.status !== "PAID") {
    throw new DomainError("BAD_REQUEST", "Solo un pedido pagado puede marcarse despachado");
  }
  await db.order.update({ where: { id }, data: { status: "FULFILLED" } });
  return getOrderById(id);
}
