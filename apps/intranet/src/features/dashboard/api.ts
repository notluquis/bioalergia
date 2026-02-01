import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { Transaction } from "../finance/types";

export interface StatsResponse {
  byType: { description: null | string; direction: "IN" | "NEUTRO" | "OUT"; total: number }[];
  monthly: { in: number; month: string; net: number; out: number }[];
  totals: Record<string, number>;
}

const RecentMovementsResponseSchema = z.object({
  data: z.array(z.unknown()),
});

const StatsResponseSchema = z.object({
  byType: z.array(
    z.object({
      description: z.string().nullable(),
      direction: z.enum(["IN", "NEUTRO", "OUT"]),
      total: z.number(),
    }),
  ),
  monthly: z.array(
    z.object({
      in: z.number(),
      month: z.string(),
      net: z.number(),
      out: z.number(),
    }),
  ),
  totals: z.record(z.string(), z.number()),
});

export async function fetchRecentMovements(): Promise<Transaction[]> {
  const data = await apiClient.get<{ data: Transaction[] }>("/api/transactions?limit=5", {
    responseSchema: RecentMovementsResponseSchema,
  });
  return data.data;
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const searchParams = new URLSearchParams({ from, to });
  const res = await apiClient.get<StatsResponse>(
    `/api/transactions/stats?${searchParams.toString()}`,
    { responseSchema: StatsResponseSchema },
  );
  return res;
}
