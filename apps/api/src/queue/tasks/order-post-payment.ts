// graphile-worker task: durable post-payment side-effects for a paid SHOP order.
//
// Transactional-outbox-lite: the MercadoPago webhook only does the fast/critical
// inline work (mark PAID + consume reservations) and then enqueues this task. All
// the slow / failure-prone side-effects (DTE emission, Chilexpress OT, confirmation
// email, ML stock push) live here, where graphile-worker's built-in retry/backoff
// makes them DURABLE instead of best-effort-lost-on-first-error.
//
// IDEMPOTENT by construction — every step guards on already-done, so a retry (or a
// duplicate webhook that re-enqueues with the same jobKey) is safe:
//   - DTE: skip if order already has dteFolio.
//   - Chilexpress OT: skip if order already has cxOtNumber.
//   - Email: sendEmail is idempotency-keyed → safe to re-call.
//   - ML stock: best-effort, swallowed.
//
// Failure policy: THROW to let graphile-worker retry (transient: network / 5xx).
// A Chilexpress DETAIL rejection (-7 bad-address class) is a PERMANENT data error
// — retrying forever won't fix a bad address — so we log it and continue.

import { db } from "@finanzas/db";
import type { Task } from "graphile-worker";
import { z } from "zod";
import { logError, logEvent } from "../../lib/logger.ts";
import { emitDte } from "../../modules/haulmer/emit-dte.ts";
import { pushStockToMl } from "../../modules/mercadolibre/sync.ts";
import { sendOrderConfirmationEmail } from "../../services/email/transactional.ts";
import { attachDteToOrder } from "../../services/orders.ts";
import { createOrderShipment } from "../../services/shipments.ts";

// graphile-worker payloads are untrusted JSON (persisted in the DB). Validate.
const orderPostPaymentPayload = z.object({ orderId: z.number().int().positive() });

export function orderPostPaymentJobKey(orderId: number): string {
  return `order_pp_${orderId}`;
}

/**
 * A Chilexpress OT failure is PERMANENT (give up) when the rejection is a data /
 * detail-level error from createOrderShipment — those throw a friendly message
 * ("Chilexpress: …") or the "no generó la OT" fallback. Anything else (network,
 * 5xx, unexpected) is treated as TRANSIENT → rethrow so graphile-worker retries.
 * Exported for unit testing (pure fn).
 */
export function isPermanentChilexpressError(message: string): boolean {
  return /no gener[oó] la OT/i.test(message) || /^chilexpress:/i.test(message.trim());
}

export async function runOrderPostPayment(orderId: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    logError("queue.order_post_payment.order_missing", new Error(`Order ${orderId} not found`), {
      orderId,
    });
    return;
  }
  // Only act on a paid order — if the webhook hasn't marked it PAID, nothing to do
  // (and a stale/duplicate enqueue for a non-paid order is a no-op).
  if (order.status !== "PAID") {
    logEvent("queue.order_post_payment.not_paid", { orderId, status: order.status });
    return;
  }

  // ── DTE emission ──────────────────────────────────────────────────────────
  // Idempotent: skip if already emitted. On failure THROW → graphile retries.
  let dteFolio: string | undefined = order.dteFolio ?? undefined;
  let dtePdfUrl: string | undefined;
  if (!dteFolio) {
    const dte = await emitDte({
      documentType: order.billingType,
      customerEmail: order.customerEmail,
      customerRut: order.customerRut,
      customerName: order.customerName,
      totalClp: order.totalClp,
      lines: order.items.map((i: (typeof order.items)[number]) => {
        const snap = i.productSnapshot as { sku: string; name: string };
        return { sku: snap.sku, name: snap.name, qty: i.qty, unitPriceClp: i.unitPriceClp };
      }),
    });
    await attachDteToOrder(orderId, dte);
    dteFolio = dte.folio;
    dtePdfUrl = dte.pdfUrl;
    logEvent("queue.order_post_payment.dte_emitted", { orderId, folio: dte.folio });
  }

  // ── Chilexpress auto-OT (home delivery) ───────────────────────────────────
  // Idempotent: skip if already created. Transient errors THROW (retry); a
  // permanent address/detail rejection is logged and skipped (no retry storm).
  const addr = order.shippingAddress as {
    street?: string;
    street_number?: string;
    county_code?: string;
    service_code?: string;
  } | null;
  if (
    !order.cxOtNumber &&
    addr?.county_code &&
    addr.service_code &&
    addr.street &&
    addr.street_number
  ) {
    // The OrderItem snapshot doesn't carry weight/dims — fetch the products so the
    // OT declares real volumetric data (Chilexpress bills (H×W×L)/5000). Fall back
    // to 250g / 10×20×30 for products with no dims stored.
    const productIds = [
      ...new Set<number>(order.items.map((i: (typeof order.items)[number]) => i.productId)),
    ];
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, weightGrams: true, widthCm: true, heightCm: true, lengthCm: true },
    });
    type ShipDims = (typeof products)[number];
    const byId = new Map<number, ShipDims>(products.map((p: ShipDims) => [p.id, p]));
    const totalGrams = order.items.reduce(
      (acc: number, i: (typeof order.items)[number]) =>
        acc + (byId.get(i.productId)?.weightGrams ?? 250) * i.qty,
      0
    );
    // Single-package heuristic: largest single product by volume. Default each
    // product's missing dims to 10×20×30 BEFORE comparing — skipping a null-dim
    // product would let a smaller product win and under-declare the OT package.
    let dims: { heightCm: number; widthCm: number; lengthCm: number } | undefined;
    for (const i of order.items) {
      const p = byId.get(i.productId);
      if (!p) continue;
      const heightCm = p.heightCm ?? 10;
      const widthCm = p.widthCm ?? 20;
      const lengthCm = p.lengthCm ?? 30;
      const vol = heightCm * widthCm * lengthCm;
      if (!dims || vol > dims.heightCm * dims.widthCm * dims.lengthCm) {
        dims = { heightCm, widthCm, lengthCm };
      }
    }
    try {
      const ot = await createOrderShipment({
        orderNumber: order.number,
        streetName: addr.street,
        streetNumber: addr.street_number,
        countyCoverageCode: addr.county_code,
        serviceTypeCode: addr.service_code,
        recipientName: order.customerName,
        recipientPhone: (order.customerPhone ?? "").replace(/\D/g, "") || "000000000",
        recipientEmail: order.customerEmail,
        declaredValueClp: order.totalClp,
        weightKg: Math.max(0.3, totalGrams / 1000),
        ...(dims ?? {}),
      });
      await db.order.update({
        where: { id: orderId },
        data: {
          cxOtNumber: ot.otNumber,
          cxBarcode: ot.barcode,
          cxLabelBase64: ot.labelBase64,
          cxLabelType: ot.labelType,
        },
      });
      logEvent("queue.order_post_payment.ot_created", { orderId, otNumber: ot.otNumber });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isPermanentChilexpressError(msg)) {
        // Bad address / coverage / service — retrying won't fix it. Log for
        // manual fulfillment and continue with the rest of the side-effects.
        logError("queue.order_post_payment.ot_permanent_failure", e, { orderId });
      } else {
        // Network / 5xx / unexpected → let graphile-worker retry the whole task.
        throw e;
      }
    }
  }

  // ── Confirmation email ────────────────────────────────────────────────────
  // sendEmail is idempotency-keyed → safe to re-call on retry. Sent after DTE so
  // the folio/PDF can ride along; sends regardless of whether DTE succeeded.
  await sendOrderConfirmationEmail({
    to: order.customerEmail,
    orderNumber: order.number,
    totalClp: order.totalClp,
    items: order.items.map((i: (typeof order.items)[number]) => {
      const snap = i.productSnapshot as { name: string };
      return { name: snap.name, qty: i.qty, unitPriceClp: i.unitPriceClp };
    }),
    billingType: order.billingType,
    accessToken: order.accessToken,
    ...(dteFolio ? { dteFolio } : {}),
    ...(dtePdfUrl ? { dtePdfUrl } : {}),
  });

  // ── ML stock push (best-effort, swallow) ──────────────────────────────────
  for (const it of order.items) {
    await pushStockToMl(it.productId).catch(() => undefined);
  }

  logEvent("queue.order_post_payment.done", { orderId });
}

export const order_post_payment: Task = async (payload) => {
  const parsed = orderPostPaymentPayload.safeParse(payload);
  if (!parsed.success) {
    logError("queue.order_post_payment.invalid_payload", new Error(parsed.error.message));
    return;
  }
  await runOrderPostPayment(parsed.data.orderId);
};
