import { z } from "zod";
import { apiClient } from "@/lib/api-client";

export interface DTESummary {
  period: string;
  count: number;
  totalAmount: number;
  netAmount: number;
  taxAmount: number;
  averageAmount: number;
}

export interface YearlyComparisonData {
  month: string;
  year1Value: number;
  year2Value: number;
  year1Count: number;
  year2Count: number;
}

// Zod schemas for runtime validation
const DTESummarySchema = z.object({
  period: z.string(),
  count: z.number(),
  totalAmount: z.number(),
  netAmount: z.number(),
  taxAmount: z.number(),
  averageAmount: z.number(),
});

const DTESummaryResponseSchema = z.object({
  status: z.literal("success"),
  data: z.array(DTESummarySchema),
});

type DTESummaryResponse = z.infer<typeof DTESummaryResponseSchema>;

const YearlyComparisonDataSchema = z.object({
  month: z.string(),
  year1Value: z.number(),
  year2Value: z.number(),
  year1Count: z.number(),
  year2Count: z.number(),
});

const YearlyComparisonResponseSchema = z.object({
  status: z.literal("success"),
  data: z.array(YearlyComparisonDataSchema),
});

type YearlyComparisonResponse = z.infer<typeof YearlyComparisonResponseSchema>;

export async function fetchPurchasesSummary(year?: number): Promise<DTESummary[]> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", year.toString());
  }

  const result = await apiClient.get<DTESummaryResponse>(
    `/api/dte-analytics/purchases/summary?${params.toString()}`,
    {
      responseType: "json",
      responseSchema: DTESummaryResponseSchema,
    },
  );
  return result.data;
}

export async function fetchSalesSummary(year?: number): Promise<DTESummary[]> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", year.toString());
  }

  const result = await apiClient.get<DTESummaryResponse>(
    `/api/dte-analytics/sales/summary?${params.toString()}`,
    {
      responseType: "json",
      responseSchema: DTESummaryResponseSchema,
    },
  );
  return result.data;
}

export async function fetchYearlyComparison(
  year1: number,
  year2: number,
  type: "purchases" | "sales",
): Promise<YearlyComparisonData[]> {
  const params = new URLSearchParams({
    year1: year1.toString(),
    year2: year2.toString(),
    type,
  });

  const result = await apiClient.get<YearlyComparisonResponse>(
    `/api/dte-analytics/yearly-comparison?${params.toString()}`,
    {
      responseType: "json",
      responseSchema: YearlyComparisonResponseSchema,
    },
  );
  return result.data;
}
