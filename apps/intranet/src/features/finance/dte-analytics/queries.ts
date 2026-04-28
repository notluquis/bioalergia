import { queryOptions } from "@tanstack/react-query";

import {
  fetchDteLineItems,
  fetchPurchasesAvailablePeriods,
  fetchPurchasesDetails,
  fetchPurchasesSummary,
  fetchSalesAvailablePeriods,
  fetchSalesDetails,
  fetchSalesLinkedEvents,
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
  salesLinkedEvents: (dteSaleDetailId: string) =>
    queryOptions({
      queryFn: () => fetchSalesLinkedEvents(dteSaleDetailId),
      queryKey: ["dte-analytics", "sales", "linked-events", dteSaleDetailId],
    }),
  purchasesDetails: (params: { page: number; pageSize: number; period?: string }) =>
    queryOptions({
      queryFn: () => fetchPurchasesDetails(params),
      queryKey: ["dte-analytics", "purchases", "details", params],
    }),
  lineItems: (dteId: string, direction: "purchase" | "sale") =>
    queryOptions({
      queryFn: () => fetchDteLineItems(dteId, direction),
      queryKey: ["dte-analytics", "line-items", dteId, direction],
      enabled: !!dteId,
    }),
};
