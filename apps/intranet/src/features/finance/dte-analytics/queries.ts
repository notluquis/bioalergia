import { queryOptions } from "@tanstack/react-query";

import { fetchPurchasesSummary, fetchSalesSummary, fetchYearlyComparison } from "./api";

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
  comparison: (year1: number, year2: number, type: "purchases" | "sales") =>
    queryOptions({
      queryFn: () => fetchYearlyComparison(year1, year2, type),
      queryKey: ["dte-analytics", "comparison", year1, year2, type],
    }),
};
