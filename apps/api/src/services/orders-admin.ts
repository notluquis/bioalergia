// Admin shop-orders service. Thin oRPC handlers call these; business rules +
// DomainError live here (golden 2026). Read-only listing/detail + the
// operational FULFILLED transition (dispatch). The DTE is emitted automatically
// at payment (webhook) — fulfillment here is operational, not a DTE gate.

import { db } from "@finanzas/db";
import type { OrderDetail, OrderSummary } from "@finanzas/orpc-contracts/orders-admin";

import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { refundPayment } from "../modules/mercadopago-checkout/payment.ts";
import { releaseReservations, restockOrderItemsTx } from "../modules/reservations/index.ts";
import {
  sendOrderCancelledEmail,
  sendOrderDispatchedEmail,
  sendOrderRefundEmail,
} from "./email/transactional.ts";

// Derive the where type from the configured client's method (not the standalone
// alias, whose generic params don't match the options-parameterized client).
type OrderWhereInput = NonNullable<NonNullable<Parameters<typeof db.order.findMany>[0]>["where"]>;

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
    cx_ot_number: o.cxOtNumber,
    cx_label_base64: o.cxLabelBase64,
    dte_pdf_url: o.dtePdfUrl,
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
  const and: OrderWhereInput[] = [];
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

  const where: OrderWhereInput = and.length > 0 ? { AND: and } : {};
  const rows = await db.order.findMany({
    where,
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
  const detail = await getOrderById(id);

  // Notify the buyer their order shipped (best-effort — never fail the action).
  try {
    const comuna = (detail.shipping_address as { city?: string } | null)?.city ?? null;
    const tokenRow = await db.order.findUnique({ where: { id }, select: { accessToken: true } });
    await sendOrderDispatchedEmail({
      to: detail.customer_email,
      orderNumber: detail.number,
      shippedToComuna: comuna,
      accessToken: tokenRow?.accessToken,
    });
  } catch (e) {
    logError("orders-admin.dispatch_email_failed", e, { orderId: id });
  }
  return detail;
}

export async function cancelOrder(id: number): Promise<OrderDetail> {
  const existing = await db.order.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  // Cancel is only for unpaid orders. A paid order must be refunded (money back).
  if (existing.status !== "PENDING") {
    throw new DomainError(
      "BAD_REQUEST",
      "Solo un pedido pendiente (sin pago) puede cancelarse. Usa reembolso para uno pagado."
    );
  }
  await releaseReservations(id);
  await db.order.update({ where: { id }, data: { status: "CANCELLED" } });
  const detail = await getOrderById(id);

  // Notify the buyer their (unpaid) order was cancelled — best-effort.
  try {
    const tokenRow = await db.order.findUnique({ where: { id }, select: { accessToken: true } });
    await sendOrderCancelledEmail({
      to: detail.customer_email,
      orderNumber: detail.number,
      accessToken: tokenRow?.accessToken,
    });
  } catch (e) {
    logError("orders-admin.cancel_email_failed", e, { orderId: id });
  }
  return detail;
}

export async function refundOrder(id: number): Promise<OrderDetail> {
  const existing = await db.order.findUnique({ where: { id }, include: { payments: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Pedido no encontrado");
  // Refund only a paid, not-yet-dispatched order (a shipped order's stock is gone
  // and needs a manual return flow). DTE credit note (nota de crédito, type 61)
  // is NOT auto-emitted — issue it manually in Haulmer.
  if (existing.status !== "PAID") {
    throw new DomainError(
      "BAD_REQUEST",
      "Solo un pedido pagado y no despachado puede reembolsarse"
    );
  }
  type PaymentRow = (typeof existing.payments)[number];
  const payment = existing.payments.find(
    (p: PaymentRow) => p.provider === "MERCADO_PAGO" && p.providerPaymentId
  );
  if (!payment?.providerPaymentId) {
    throw new DomainError("BAD_REQUEST", "No hay un pago de MercadoPago para reembolsar");
  }

  // Idempotency guard against a DOUBLE external refund: if a prior attempt already
  // refunded in MercadoPago (payment row REFUNDED) but its DB txn failed, the
  // order can still be PAID — an operator retry must NOT fire a second MP refund,
  // only re-run the DB fix below.
  const alreadyRefunded = existing.payments.some(
    (p: PaymentRow) => p.status === "REFUNDED"
  );

  // The MercadoPago refund is external and NOT undoable once it succeeds. After
  // it returns, fold the THREE DB mutations (restock items + order→REFUNDED +
  // payment rows→REFUNDED) into a SINGLE transaction so they're all-or-nothing.
  // If the txn fails, the money is already back but the DB is inconsistent →
  // log at CRITICAL and surface a reconciliation error to the operator.
  if (!alreadyRefunded) {
    await refundPayment(payment.providerPaymentId);
  }
  try {
    await db.$transaction(async (tx) => {
      await restockOrderItemsTx(tx, id);
      await tx.order.update({ where: { id }, data: { status: "REFUNDED" } });
      await tx.payment.updateMany({ where: { orderId: id }, data: { status: "REFUNDED" } });
    });
  } catch (e) {
    // Persist the fact that the external refund already happened (best-effort,
    // outside the failed txn) so a retry sees payment REFUNDED and skips the
    // second MP refund via the guard above.
    await db.payment
      .updateMany({ where: { orderId: id }, data: { status: "REFUNDED" } })
      .catch(() => undefined);
    logError("orders-admin.refund_db_inconsistent", e, { orderId: id, severity: "CRITICAL" });
    throw new DomainError(
      "CONFLICT",
      `El reembolso en MercadoPago se realizó, pero no se pudo actualizar el pedido ${existing.number}. Requiere reconciliación manual: marca el pedido como reembolsado y repón el stock a mano.`,
      { orderId: id }
    );
  }

  const detail = await getOrderById(id);

  // Confirm the refund to the buyer — best-effort (the money is already back).
  try {
    const tokenRow = await db.order.findUnique({ where: { id }, select: { accessToken: true } });
    await sendOrderRefundEmail({
      to: detail.customer_email,
      orderNumber: detail.number,
      totalClp: detail.total_clp,
      accessToken: tokenRow?.accessToken,
    });
  } catch (e) {
    logError("orders-admin.refund_email_failed", e, { orderId: id });
  }
  return detail;
}
