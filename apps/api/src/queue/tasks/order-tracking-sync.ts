// graphile-worker task: sync Chilexpress tracking for shipped SHOP orders and
// close the loop when they land. Loads FULFILLED orders that have an OT, bulk-
// tracks them in one /tracking/bulk request, and for any whose status reads as
// delivered flips Order.status FULFILLED → DELIVERED and emails the buyer.
//
// Best-effort per order: one bad order (or email failure) must not abort the
// batch. Runs on an interval cron (every 30 min).

import { db } from "@finanzas/db";
import type { Task } from "graphile-worker";
import { logError, logEvent } from "../../lib/logger.ts";
import { sendOrderDeliveredEmail } from "../../services/email/transactional.ts";
import { trackOrders } from "../../services/shipments.ts";

export const order_tracking_sync: Task = async () => {
  const started = Date.now();
  const orders = await db.order.findMany({
    where: { status: "FULFILLED", cxOtNumber: { not: null } },
    select: {
      id: true,
      number: true,
      cxOtNumber: true,
      customerEmail: true,
      accessToken: true,
    },
  });
  if (orders.length === 0) {
    logEvent("queue.order_tracking_sync.noop", {});
    return;
  }

  let statusByRef: Map<string, string>;
  try {
    statusByRef = await trackOrders(
      // cxOtNumber is non-null by the where filter; TS can't narrow the select.
      orders.map((o) => ({ number: o.number, cxOtNumber: o.cxOtNumber as string }))
    );
  } catch (e) {
    logError("queue.order_tracking_sync.track_failed", e);
    return;
  }

  let delivered = 0;
  for (const o of orders) {
    try {
      const status = statusByRef.get(`BIO-ORD-${o.number}`);
      // ponytail: string-match on Chilexpress status, tighten if they expose a code
      if (!status || !/entregad/i.test(status)) continue;
      await db.order.update({ where: { id: o.id }, data: { status: "DELIVERED" } });
      await sendOrderDeliveredEmail({
        to: o.customerEmail,
        orderNumber: o.number,
        accessToken: o.accessToken,
      });
      delivered++;
    } catch (e) {
      logError("queue.order_tracking_sync.order_failed", e, { orderId: o.id });
    }
  }
  logEvent("queue.order_tracking_sync.done", {
    ms: Date.now() - started,
    total: orders.length,
    delivered,
  });
};
