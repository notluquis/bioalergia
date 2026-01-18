import { apiClient } from "@/lib/apiClient";

import type { Transaction } from "../finance/types";

export interface StatsResponse {
  byType: { description: null | string; direction: "IN" | "NEUTRO" | "OUT"; total: number }[];
  monthly: { in: number; month: string; net: number; out: number }[];
  totals: Record<string, number>;
}

export async function fetchRecentMovements(): Promise<Transaction[]> {
  const data = await apiClient.get<{ data: Transaction[] }>("/api/transactions?limit=5");
  return data.data;
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const searchParams = new URLSearchParams({ from, to });
  const res = await apiClient.get<StatsResponse>(`/api/transactions/stats?${searchParams.toString()}`);
  return res;
}
