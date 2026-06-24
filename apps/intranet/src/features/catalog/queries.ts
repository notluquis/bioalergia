import { queryOptions } from "@tanstack/react-query";

import { getCategories, getProductById, getProducts } from "./api";

export const catalogKeys = {
  all: ["catalog"] as const,
  products: (opts?: { includeInactive?: boolean; q?: string }) =>
    queryOptions({
      queryFn: () => getProducts({ includeInactive: opts?.includeInactive, q: opts?.q }),
      queryKey: ["catalog", "products", opts ?? {}],
    }),
  product: (id: number) =>
    queryOptions({
      queryFn: () => getProductById(id),
      queryKey: ["catalog", "product", id],
    }),
  categories: () =>
    queryOptions({
      queryFn: () => getCategories(),
      queryKey: ["catalog", "categories"],
    }),
};
