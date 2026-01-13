import { queryOptions } from "@tanstack/react-query";

import * as api from "./api";

export const inventoryKeys = {
  all: ["inventory"] as const,
  items: () =>
    queryOptions({
      queryKey: ["inventory", "items"],
      queryFn: () => api.getInventoryItems(),
    }),
  categories: () =>
    queryOptions({
      queryKey: ["inventory", "categories"],
      queryFn: () => api.getInventoryCategories(),
    }),
  allergyOverview: () =>
    queryOptions({
      queryKey: ["inventory", "allergy-overview"],
      queryFn: () => api.fetchAllergyOverview(),
    }),
};
