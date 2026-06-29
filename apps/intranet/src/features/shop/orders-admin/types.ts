import type { OrderDetail, OrderSummary } from "@finanzas/orpc-contracts/orders-admin";

export type { OrderDetail, OrderSummary };

export type OrderStatus = OrderSummary["status"];
export type OrderBillingType = OrderSummary["billing_type"];

export interface OrdersListFilters {
  /** Server-side status filter. `undefined` = all statuses. */
  status?: OrderStatus;
  /** Server-side search (number / customer name / email). */
  search?: string;
  /** Page size requested from the server (1–100). */
  limit?: number;
  /** Opaque cursor (order id) for the next page. */
  cursor?: number;
}

export interface OrdersListResult {
  orders: OrderSummary[];
  next_cursor: number | null;
}
