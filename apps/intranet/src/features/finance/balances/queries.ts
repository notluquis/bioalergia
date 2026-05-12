import { queryOptions } from "@tanstack/react-query";

import { fetchBalances } from "./api";

export const balanceKeys = {
  all: ["daily-balances"] as const,
  range: (from: string, to: string) =>
    queryOptions({
      queryFn: () => fetchBalances(from, to),
      queryKey: ["daily-balances", from, to],
    }),
};
