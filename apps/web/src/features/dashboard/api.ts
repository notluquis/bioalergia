import { apiClient } from "@/lib/apiClient";

import type { Transaction } from "../finance/types";

export interface StatsResponse {
  monthly: { month: string; in: number; out: number; net: number }[];
  totals: Record<string, number>;
  byType: { description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }[];
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const searchParams = new URLSearchParams({ from, to });
  const res = await apiClient.get<StatsResponse>(`/api/transactions/stats?${searchParams.toString()}`);
  return res;
}

export async function fetchRecentMovements(): Promise<Transaction[]> {
  const data = await apiClient.get<{ data: Transaction[] }>("/api/transactions?limit=5");
  return data.data;
}
