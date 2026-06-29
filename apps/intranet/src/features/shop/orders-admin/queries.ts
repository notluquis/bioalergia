import { queryOptions } from "@tanstack/react-query";

import { fetchOrderDetail, fetchOrders } from "./api";
import type { OrdersListFilters } from "./types";

export const orderKeys = {
  all: ["orders-admin"] as const,
  detail: (id: number) =>
    queryOptions({
      queryFn: () => fetchOrderDetail(id),
      queryKey: ["orders-admin", "detail", id],
    }),
  list: (filters: OrdersListFilters = {}) =>
    queryOptions({
      queryFn: () => fetchOrders(filters),
      queryKey: ["orders-admin", "list", filters],
    }),
};
