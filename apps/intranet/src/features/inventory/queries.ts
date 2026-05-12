import { queryOptions } from "@tanstack/react-query";

import { fetchAllergyOverview, getInventoryCategories, getInventoryItems } from "./api";

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
};
