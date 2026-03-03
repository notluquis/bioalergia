import { queryOptions } from "@tanstack/react-query";

import {
  fetchPurchasesAvailablePeriods,
  fetchPurchasesDetails,
  fetchPurchasesSummary,
  fetchSalesAvailablePeriods,
  fetchSalesDetails,
  fetchSalesSummary,
} from "./api";

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
  salesAvailablePeriods: () =>
    queryOptions({
      queryFn: fetchSalesAvailablePeriods,
      queryKey: ["dte-analytics", "sales", "available-periods"],
      staleTime: 5 * 60 * 1000,
    }),
  purchasesAvailablePeriods: () =>
    queryOptions({
      queryFn: fetchPurchasesAvailablePeriods,
      queryKey: ["dte-analytics", "purchases", "available-periods"],
      staleTime: 5 * 60 * 1000,
    }),
  salesDetails: (params: { page: number; pageSize: number; period?: string }) =>
    queryOptions({
      queryFn: () => fetchSalesDetails(params),
      queryKey: ["dte-analytics", "sales", "details", params],
    }),
  purchasesDetails: (params: { page: number; pageSize: number; period?: string }) =>
    queryOptions({
      queryFn: () => fetchPurchasesDetails(params),
      queryKey: ["dte-analytics", "purchases", "details", params],
    }),
};
