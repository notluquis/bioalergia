import type { DbMovement } from "@/features/finance/types";
import { apiClient } from "@/lib/apiClient";

export type StatsResponse = {
  status: "ok";
  monthly: Array<{ month: string; in: number; out: number; net: number }>;
  totals: Record<string, number>;
  byType: Array<{ description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }>;
};

export type TransactionsResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  message?: string;
};

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const params = new URLSearchParams({ from, to });
  const res = await apiClient.get<StatsResponse>(`/api/transactions/stats?${params.toString()}`);
  return res;
}

export async function fetchRecentMovements(): Promise<DbMovement[]> {
  const params = new URLSearchParams({ page: "1", pageSize: "5", includeAmounts: "true" });
  const res = await apiClient.get<TransactionsResponse>(`/api/transactions?${params.toString()}`);
  return res.data;
}
