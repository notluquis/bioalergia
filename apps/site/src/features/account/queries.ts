import { queryOptions } from "@tanstack/react-query";

import { accountClient, siteAuthClient } from "@/lib/orpc-client";

export const accountKeys = {
  all: ["account"] as const,
  me: () =>
    queryOptions({
      queryKey: ["account", "me"] as const,
      queryFn: () => siteAuthClient.me(),
      staleTime: 1000 * 60 * 5,
    }),
  orders: (limit = 20) =>
    queryOptions({
      queryKey: ["account", "orders", limit] as const,
      queryFn: () => accountClient.myOrders({ limit }),
    }),
  order: (number: string) =>
    queryOptions({
      queryKey: ["account", "order", number] as const,
      queryFn: () => accountClient.myOrderByNumber({ number }),
    }),
  addresses: () =>
    queryOptions({
      queryKey: ["account", "addresses"] as const,
      queryFn: () => accountClient.myAddresses(),
    }),
  passkeys: () =>
    queryOptions({
      queryKey: ["account", "passkeys"] as const,
      queryFn: () => siteAuthClient.passkeyList(),
    }),
};
