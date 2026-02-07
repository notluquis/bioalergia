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

interface DTESummaryResponse {
  status: "success";
  data: DTESummary[];
}

interface YearlyComparisonResponse {
  status: "success";
  data: YearlyComparisonData[];
}

export async function fetchPurchasesSummary(year?: number): Promise<DTESummary[]> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", year.toString());
  }

  const result = await apiClient.getRaw<DTESummaryResponse>(
    `/api/dte-analytics/purchases/summary?${params.toString()}`,
    { responseType: "text" },
  );
  return result.data;
}

export async function fetchSalesSummary(year?: number): Promise<DTESummary[]> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", year.toString());
  }

  const result = await apiClient.getRaw<DTESummaryResponse>(
    `/api/dte-analytics/sales/summary?${params.toString()}`,
    { responseType: "text" },
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

  const result = await apiClient.getRaw<YearlyComparisonResponse>(
    `/api/dte-analytics/yearly-comparison?${params.toString()}`,
    { responseType: "text" },
  );
  return result.data;
}
