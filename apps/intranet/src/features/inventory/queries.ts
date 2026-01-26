import { queryOptions } from "@tanstack/react-query";

import * as api from "./api";

export const inventoryKeys = {
  all: ["inventory"] as const,
  allergyOverview: () =>
    queryOptions({
      queryFn: () => api.fetchAllergyOverview(),
      queryKey: ["inventory", "allergy-overview"],
    }),
  categories: () =>
    queryOptions({
      queryFn: () => api.getInventoryCategories(),
      queryKey: ["inventory", "categories"],
    }),
  items: () =>
    queryOptions({
      queryFn: () => api.getInventoryItems(),
      queryKey: ["inventory", "items"],
    }),
};
