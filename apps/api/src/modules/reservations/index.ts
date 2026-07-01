// Stock reservations: claim/release/consume + CAS optimista en Product.version.
// Política: reservar al entrar a /checkout (no en add-to-cart) — golden 2026
// standard para catálogos chicos sin flash sales [[feedback-cart-2026]].

import { db } from "@finanzas/db";

const RESERVATION_TTL_MIN = Number(process.env.RESERVATION_TTL_MIN ?? "15");

// Transaction client handed to the `$transaction(async (tx) => …)` callback.
// Derived from the configured client so callers can run the restock logic
// inside their own transaction (e.g. refund atomicity in orders-admin).
// `Parameters<typeof db.$transaction>` collapses to the array-of-operations
// overload (poisoning the extraction), so infer the client type from a real
// callback-form call instead. This probe is only referenced in a type position
// (`typeof`), never invoked at runtime.
function txClientProbe() {
  return db.$transaction((tx) => Promise.resolve(tx));
}
type TxClient = Awaited<ReturnType<typeof txClientProbe>>;

export async function reserveStockForOrder(opts: {
  orderId: number;
  items: Array<{ productId: number; qty: number }>;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MIN * 60 * 1000);

  // Lazy cleanup (golden 2026 — no cron): cada reserve libera previas
  // expiradas en la misma txn. Evita stock fantasma sin background job.
  await db.$transaction(async (tx) => {
    const stale = await tx.stockReservation.findMany({
      where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    });
    for (const r of stale) {
      // Flip ACTIVE→EXPIRED guarded on status, and only restock the rows we
      // actually flipped: a concurrent consume (approval webhook) may have
      // already CONSUMED this row — restocking it would oversell a paid order.
      const flipped = await tx.stockReservation.updateMany({
        where: { id: r.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      if (flipped.count === 1) {
        await tx.product.update({
          where: { id: r.productId },
          data: {
            availableQty: { increment: r.qty },
            version: { increment: 1 },
          },
        });
      }
    }

    // CAS por línea — si alguna falla, rollback de todas.
    for (const item of opts.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          availableQty: true,
          safetyStock: true,
          version: true,
          status: true,
        },
      });
      if (!product || product.status !== "ACTIVE") {
        throw new Error(`Producto ${item.productId} no disponible`);
      }
      const sellable = product.availableQty - product.safetyStock;
      if (sellable < item.qty) {
        throw new Error(
          `Stock insuficiente producto ${item.productId} (disponible: ${Math.max(0, sellable)})`
        );
      }
      // CAS: decrement only if version matches.
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          version: product.version,
        },
        data: {
          availableQty: { decrement: item.qty },
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new Error(`Conflicto concurrente producto ${item.productId} — reintenta`);
      }
      await tx.stockReservation.create({
        data: {
          productId: item.productId,
          qty: item.qty,
          orderId: opts.orderId,
          expiresAt,
          status: "ACTIVE",
        },
      });
    }
  });
}

export async function consumeReservations(orderId: number): Promise<void> {
  await db.stockReservation.updateMany({
    where: { orderId, status: "ACTIVE" },
    data: { status: "CONSUMED" },
  });
}

/** Per-item restock loop, runnable inside an existing transaction. Lets a caller
 *  (e.g. refund atomicity) fold the restock into the SAME txn as the order/payment
 *  status flips so they're all-or-nothing. Unconditionally increments availableQty
 *  — caller guards against double-calling via the order status (REFUNDED terminal). */
export async function restockOrderItemsTx(tx: TxClient, orderId: number): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, qty: true },
  });
  for (const it of items) {
    await tx.product.update({
      where: { id: it.productId },
      data: { availableQty: { increment: it.qty }, version: { increment: 1 } },
    });
  }
}

/** Return a paid order's items to stock on refund (reservations are already
 *  CONSUMED). Caller must guard against double-calling via the order status
 *  (REFUNDED is terminal), since this unconditionally increments availableQty.
 *  Opens its own transaction; for refund atomicity use {@link restockOrderItemsTx}
 *  inside the caller's txn instead. */
export async function restockOrderItems(orderId: number): Promise<void> {
  await db.$transaction(async (tx) => {
    await restockOrderItemsTx(tx, orderId);
  });
}

export async function releaseReservations(orderId: number): Promise<void> {
  // Re-incrementa stock y marca como RELEASED. Flip-first per row (lock the
  // reservation row before the product) to match the sweep/lazy-cleanup lock
  // order — the opposite order can deadlock if release + sweep run concurrently —
  // and to skip rows a concurrent consume already moved off ACTIVE.
  await db.$transaction(async (tx) => {
    const active = await tx.stockReservation.findMany({
      where: { orderId, status: "ACTIVE" },
    });
    for (const r of active) {
      const flipped = await tx.stockReservation.updateMany({
        where: { id: r.id, status: "ACTIVE" },
        data: { status: "RELEASED" },
      });
      if (flipped.count === 1) {
        await tx.product.update({
          where: { id: r.productId },
          data: {
            availableQty: { increment: r.qty },
            version: { increment: 1 },
          },
        });
      }
    }
  });
}

export async function sweepExpiredReservations(): Promise<number> {
  // All inside one txn + a per-row status guard: the approval webhook can consume
  // a reservation concurrently, so only expire+restock rows still ACTIVE at the
  // moment we flip them (count===1). Otherwise the sweep would return stock for
  // an order that just became PAID.
  return db.$transaction(async (tx) => {
    const expired = await tx.stockReservation.findMany({
      where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    });
    let count = 0;
    for (const r of expired) {
      const flipped = await tx.stockReservation.updateMany({
        where: { id: r.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      if (flipped.count === 1) {
        await tx.product.update({
          where: { id: r.productId },
          data: {
            availableQty: { increment: r.qty },
            version: { increment: 1 },
          },
        });
        count++;
      }
    }
    return count;
  });
}
