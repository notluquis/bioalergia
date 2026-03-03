import { apiClient } from "@/lib/api-client";
import type { DTEPurchaseDetail, DTESalesDetail, DTESummaryRaw } from "./types";
import {
  DTEPeriodsResponseSchema,
  DTEPurchaseDetailArraySchema,
  DTEPurchaseDetailResponseSchema,
  DTESalesDetailArraySchema,
  DTESalesDetailResponseSchema,
  DTESummaryArraySchema,
  DTESummaryResponseSchema,
} from "./validators";

/**
 * Fetch purchases summary aggregated by period
 * Optionally filtered by year
 * Returns raw DTE summaries with validated period format
 */
export async function fetchPurchasesSummary(year?: number): Promise<DTESummaryRaw[]> {
  const params = new URLSearchParams();
  if (year !== undefined) {
    params.set("year", year.toString());
  }

  const url = `/api/dte-analytics/purchases/summary${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const response = await apiClient.get(url, {
    responseType: "json",
    responseSchema: DTESummaryResponseSchema,
  });

  const data = (response as unknown as { data: unknown }).data;
  return DTESummaryArraySchema.parse(data);
}

/**
 * Fetch sales summary aggregated by period
 * Optionally filtered by year
 */
export async function fetchSalesSummary(year?: number): Promise<DTESummaryRaw[]> {
  const params = new URLSearchParams();
  if (year !== undefined) {
    params.set("year", year.toString());
  }

  const url = `/api/dte-analytics/sales/summary${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await apiClient.get(url, {
    responseType: "json",
    responseSchema: DTESummaryResponseSchema,
  });

  const data = (response as unknown as { data: unknown }).data;
  return DTESummaryArraySchema.parse(data);
}

export interface DTEListParams {
  page?: number;
  pageSize?: number;
  period?: string;
}

export interface DTEListResponse<TItem> {
  data: TItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchSalesAvailablePeriods(): Promise<string[]> {
  const response = await apiClient.get("/api/dte-analytics/sales/available-periods", {
    responseType: "json",
    responseSchema: DTEPeriodsResponseSchema,
  });

  const data = (response as unknown as { data: unknown }).data;
  return DTEPeriodsResponseSchema.shape.data.parse(data);
}

export async function fetchPurchasesAvailablePeriods(): Promise<string[]> {
  const response = await apiClient.get("/api/dte-analytics/purchases/available-periods", {
    responseType: "json",
    responseSchema: DTEPeriodsResponseSchema,
  });

  const data = (response as unknown as { data: unknown }).data;
  return DTEPeriodsResponseSchema.shape.data.parse(data);
}

export async function fetchSalesDetails(
  params: DTEListParams,
): Promise<DTEListResponse<DTESalesDetail>> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 50));
  if (params.period) {
    query.set("period", params.period);
  }

  const response = await apiClient.get(`/api/dte-analytics/sales/details?${query.toString()}`, {
    responseType: "json",
    responseSchema: DTESalesDetailResponseSchema,
  });

  const payload = response as unknown as { data: unknown; meta: unknown };
  return {
    data: DTESalesDetailArraySchema.parse(payload.data),
    meta: DTESalesDetailResponseSchema.shape.meta.parse(payload.meta),
  };
}

export async function fetchPurchasesDetails(
  params: DTEListParams,
): Promise<DTEListResponse<DTEPurchaseDetail>> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 50));
  if (params.period) {
    query.set("period", params.period);
  }

  const response = await apiClient.get(`/api/dte-analytics/purchases/details?${query.toString()}`, {
    responseType: "json",
    responseSchema: DTEPurchaseDetailResponseSchema,
  });

  const payload = response as unknown as { data: unknown; meta: unknown };
  return {
    data: DTEPurchaseDetailArraySchema.parse(payload.data),
    meta: DTEPurchaseDetailResponseSchema.shape.meta.parse(payload.meta),
  };
}
