import { apiClient } from "@/lib/api-client";
import type { DTESummaryRaw } from "./types";
import { DTESummaryArraySchema, DTESummaryResponseSchema } from "./validators";

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
