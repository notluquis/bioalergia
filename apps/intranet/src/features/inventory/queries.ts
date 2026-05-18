import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  fetchAllergyOverview,
  getInventoryCategories,
  getInventoryItems,
  listInventoryMovements,
  type ListMovementsResponse,
} from "./api";

export interface MovementsFilters {
  from?: string;
  item_id?: number;
  limit?: number;
  search?: string;
  to?: string;
}

export const inventoryKeys = {
  all: ["inventory"] as const,
  allergyOverview: () =>
    queryOptions({
      queryFn: () => fetchAllergyOverview(),
      queryKey: ["inventory", "allergy-overview"],
    }),
  categories: () =>
    queryOptions({
      queryFn: () => getInventoryCategories(),
      queryKey: ["inventory", "categories"],
    }),
  items: () =>
    queryOptions({
      queryFn: () => getInventoryItems(),
      queryKey: ["inventory", "items"],
    }),
  movements: (filters: MovementsFilters = {}) =>
    infiniteQueryOptions({
      getNextPageParam: (lastPage: ListMovementsResponse): number | undefined =>
        lastPage.data.next_cursor ?? undefined,
      initialPageParam: undefined as number | undefined,
      queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
        listInventoryMovements({
          cursor: pageParam,
          from: filters.from,
          item_id: filters.item_id,
          limit: filters.limit,
          search: filters.search,
          to: filters.to,
        }),
      queryKey: ["inventory", "movements", filters],
    }),
};

export const inventoryQueries = inventoryKeys;
