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

export interface AllYearsComparisonData {
  month: string;
  [key: string]: number | string;
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

export async function fetchAllYearsComparison(
  type: "purchases" | "sales",
): Promise<AllYearsComparisonData[]> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  const comparisons: YearlyComparisonData[][] = [];

  // Fetch comparisons for consecutive year pairs
  for (let i = 0; i < years.length - 1; i++) {
    const y1 = years[i];
    const y2 = years[i + 1];
    if (y1 !== undefined && y2 !== undefined) {
      const data = await fetchYearlyComparison(y1, y2, type);
      comparisons.push(data);
    }
  }

  // Combine all comparisons into a single structure
  if (comparisons.length === 0 || !comparisons[0]) {
    return [];
  }

  const firstComparison = comparisons[0];
  const result = firstComparison.map((_item, monthIndex) => {
    const combined: AllYearsComparisonData = { month: _item.month };
    years.forEach((year, yearIndex) => {
      if (year !== undefined) {
        if (yearIndex === 0) {
          const val = comparisons[0]?.[monthIndex]?.year1Value;
          combined[`year${year}`] = val ?? 0;
        }
        if (yearIndex < comparisons.length) {
          const comparison = comparisons[yearIndex];
          const val = comparison?.[monthIndex]?.year2Value;
          const nextYear = years[yearIndex + 1];
          if (nextYear !== undefined) {
            combined[`year${nextYear}`] = val ?? 0;
          }
        }
      }
    });
    return combined;
  });

  return result;
}
