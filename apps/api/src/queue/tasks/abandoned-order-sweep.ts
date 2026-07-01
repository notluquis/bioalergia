// graphile-worker task: cancel abandoned SHOP orders. An order that's been
// PENDING for more than 3 days was never paid (Checkout Pro completed or the
// buyer walked away); cancel it and release any stock still held for it so the
// inventory returns to availability. Best-effort per order. Runs daily.

import { db } from "@finanzas/db";
import type { Task } from "graphile-worker";
import { logError, logEvent } from "../../lib/logger.ts";
import { releaseReservations } from "../../modules/reservations/index.ts";

export const abandoned_order_sweep: Task = async () => {
  const started = Date.now();
  // ponytail: 3-day cutoff, config later if needed
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const stale = await db.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  let cancelled = 0;
  for (const o of stale) {
    try {
      await db.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
      await releaseReservations(o.id);
      cancelled++;
    } catch (e) {
      logError("queue.abandoned_order_sweep.order_failed", e, { orderId: o.id });
    }
  }
  logEvent("queue.abandoned_order_sweep.done", {
    ms: Date.now() - started,
    total: stale.length,
    cancelled,
  });
};
