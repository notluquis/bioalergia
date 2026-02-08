import { queryOptions } from "@tanstack/react-query";

import { fetchPurchasesSummary, fetchSalesSummary } from "./api";

export const dteAnalyticsKeys = {
  all: ["dte-analytics"] as const,
  purchases: (year?: number) =>
    queryOptions({
      queryFn: () => fetchPurchasesSummary(year),
      queryKey: ["dte-analytics", "purchases", year],
    }),
  sales: (year?: number) =>
    queryOptions({
      queryFn: () => fetchSalesSummary(year),
      queryKey: ["dte-analytics", "sales", year],
    }),
};
