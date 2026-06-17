// Pure formatting helpers for account order summaries. NODE-safe (no DOM, no
// React, no oRPC) so they can be unit-tested at 100% coverage. The route
// components (mi-cuenta dashboard + pedidos list) previously formatted dates
// and item counts inline; extracting them here keeps the Views presentational
// and the formatting behaviour byte-identical + testable.

import type { AccountContract } from "@finanzas/orpc-contracts/account";
import type { InferContractRouterOutputs } from "@orpc/contract";

export type AccountOrderSummary =
  InferContractRouterOutputs<AccountContract>["myOrders"]["data"][number];

/**
 * Short date (no time), matching the dashboard's previous
 * `new Date(order.created_at).toLocaleDateString("es-CL")`.
 */
export function formatOrderDateShort(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("es-CL");
}

/**
 * Date + time, matching the orders list's previous
 * `new Date(order.created_at).toLocaleString("es-CL")`.
 */
export function formatOrderDateTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString("es-CL");
}

/**
 * Pluralized item-count label, e.g. `3 ítem(s)`. Kept literal to the original
 * markup (the routes always rendered `(s)` regardless of count).
 */
export function formatItemCount(count: number): string {
  return `${count} ítem(s)`;
}
