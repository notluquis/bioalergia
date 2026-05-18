import { queryOptions } from "@tanstack/react-query";

import { cartClient, catalogClient } from "@/lib/orpc-client";

export const shopKeys = {
  all: ["shop"] as const,
  products: () =>
    queryOptions({
      queryKey: ["shop", "products"],
      queryFn: () => catalogClient.list({ limit: 50 }),
    }),
  product: (slug: string) =>
    queryOptions({
      queryKey: ["shop", "product", slug],
      queryFn: () => catalogClient.getBySlug({ slug }),
    }),
  cart: () =>
    queryOptions({
      queryKey: ["shop", "cart"],
      queryFn: () => cartClient.get(),
    }),
};
