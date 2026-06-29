import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { fetchOrderDetail, fetchOrders } from "./api";
import type { OrdersListFilters } from "./types";

export const orderKeys = {
  all: ["orders-admin"] as const,
  detail: (id: number) =>
    queryOptions({
      queryFn: () => fetchOrderDetail(id),
      queryKey: ["orders-admin", "detail", id],
    }),
  // Cursor-paginated: "Cargar más" fetches the next page so admins can reach
  // orders past the first page (the server caps each page at 100).
  list: (filters: OrdersListFilters = {}) =>
    infiniteQueryOptions({
      queryKey: ["orders-admin", "list", filters],
      queryFn: ({ pageParam }) => fetchOrders({ ...filters, cursor: pageParam }),
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    }),
};
