import { queryOptions } from "@tanstack/react-query";

import { dailyBalanceApi } from "./api";

export const productionBalanceKeys = {
  all: ["production-balances"] as const,
  week: (startOfWeek: string, endOfWeek: string) =>
    queryOptions({
      queryFn: async () => {
        const response = await dailyBalanceApi.getBalances(startOfWeek, endOfWeek);
        return response.items;
      },
      queryKey: ["production-balances", "week", startOfWeek, endOfWeek],
    }),
};
