import { apiClient } from "@/lib/apiClient";

import type { Transaction } from "../finance/types";

export interface StatsResponse {
  monthly: { month: string; in: number; out: number; net: number }[];
  totals: Record<string, number>;
  byType: { description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }[];
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const searchParams = new URLSearchParams({ from, to });
  const res = await apiClient.get<StatsResponse>(`/api/dashboard/stats?${searchParams.toString()}`);
  return res;
}

export async function fetchRecentMovements(): Promise<Transaction[]> {
  const data = await apiClient.get<Transaction[]>("/api/finance/movements?limit=5");
  return data;
}
