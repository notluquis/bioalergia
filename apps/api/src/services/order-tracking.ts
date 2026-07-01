// W3-C: lazy on-view Chilexpress tracking refresh.
//
// Chilexpress has no native tracking webhook, so instead of a `*/30` cron that
// polls every shipped order, we refresh a single order's tracking LAZILY when
// someone views it (the buyer status page polls, the admin opens the detail).
// Event-driven, $0, no cron. A per-order throttle (`Order.trackingCheckedAt`)
// keeps a polling status page from hammering the carrier on every request.
//
// Reuses `trackOrders` (bulk-track endpoint, called with one order here) plus
// the delivered heuristic + FULFILLED → DELIVERED transition + delivered email
// that previously lived in the deleted `order_tracking_sync` task.

import { db } from "@finanzas/db";
import { logError, logEvent } from "../lib/logger.ts";
import { sendOrderDeliveredEmail } from "./email/transactional.ts";
import { trackOrders } from "./shipments.ts";

// Don't re-hit Chilexpress more than once per this window per order.
const TRACKING_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Refresh one order's Chilexpress tracking if it's a shipped order whose last
 * check is stale (> 15 min ago). Flips FULFILLED → DELIVERED + emails the buyer
 * when the OT reads as delivered. Best-effort: a carrier error is logged and
 * swallowed so the caller's page never breaks (last-known status is preserved).
 * Always stamps `trackingCheckedAt` on a successful carrier call so the throttle
 * advances.
 */
export async function refreshOrderTrackingIfStale(orderId: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      cxOtNumber: true,
      customerEmail: true,
      accessToken: true,
      trackingCheckedAt: true,
    },
  });
  // Nothing to track: not shipped yet, or no OT to look up.
  if (!order || order.status !== "FULFILLED" || !order.cxOtNumber) return;
  // Throttle: skip if we checked within the window.
  if (
    order.trackingCheckedAt &&
    Date.now() - order.trackingCheckedAt.getTime() < TRACKING_THROTTLE_MS
  ) {
    return;
  }

  let status: string | undefined;
  try {
    const statusByRef = await trackOrders([
      { number: order.number, cxOtNumber: order.cxOtNumber },
    ]);
    status = statusByRef.get(`BIO-ORD-${order.number}`);
  } catch (e) {
    // Carrier down / transient error — leave last-known status, don't stamp
    // trackingCheckedAt (so the next view retries), never break the page.
    logError("order_tracking.refresh.track_failed", e, { orderId: order.id });
    return;
  }

  // ponytail: string-match on Chilexpress status, tighten if they expose a code.
  const delivered = !!status && /entregad/i.test(status);
  if (delivered) {
    await db.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED", trackingCheckedAt: new Date() },
    });
    // Best-effort: an email failure must not undo the DELIVERED transition.
    try {
      await sendOrderDeliveredEmail({
        to: order.customerEmail,
        orderNumber: order.number,
        accessToken: order.accessToken,
      });
    } catch (e) {
      logError("order_tracking.refresh.email_failed", e, { orderId: order.id });
    }
  } else {
    await db.order.update({
      where: { id: order.id },
      data: { trackingCheckedAt: new Date() },
    });
  }
  logEvent("order_tracking.refresh.done", { orderId: order.id, delivered });
}
