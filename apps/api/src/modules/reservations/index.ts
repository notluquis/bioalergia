// Stock reservations: claim/release/consume + CAS optimista en Product.version.
// Política: reservar al entrar a /checkout (no en add-to-cart) — golden 2026
// standard para catálogos chicos sin flash sales [[feedback-cart-2026]].

import { db } from "@finanzas/db";

const RESERVATION_TTL_MIN = Number(process.env.RESERVATION_TTL_MIN ?? "15");

export async function reserveStockForOrder(opts: {
  orderId: number;
  items: Array<{ productId: number; qty: number }>;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MIN * 60 * 1000);

  // CAS por línea — si alguna falla, rollback de todas.
  await db.$transaction(async (tx) => {
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

export async function releaseReservations(orderId: number): Promise<void> {
  // Re-incrementa stock y marca como RELEASED.
  await db.$transaction(async (tx) => {
    const active = await tx.stockReservation.findMany({
      where: { orderId, status: "ACTIVE" },
    });
    for (const r of active) {
      await tx.product.update({
        where: { id: r.productId },
        data: {
          availableQty: { increment: r.qty },
          version: { increment: 1 },
        },
      });
    }
    await tx.stockReservation.updateMany({
      where: { orderId, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
  });
}

export async function sweepExpiredReservations(): Promise<number> {
  const expired = await db.stockReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
  });
  if (expired.length === 0) return 0;

  await db.$transaction(async (tx) => {
    for (const r of expired) {
      await tx.product.update({
        where: { id: r.productId },
        data: {
          availableQty: { increment: r.qty },
          version: { increment: 1 },
        },
      });
    }
    await tx.stockReservation.updateMany({
      where: { id: { in: expired.map((r) => r.id) } },
      data: { status: "EXPIRED" },
    });
  });

  return expired.length;
}
