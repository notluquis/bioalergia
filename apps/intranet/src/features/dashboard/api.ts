import { z } from "zod";
import { financeORPCClient } from "@/features/finance/orpc";
import {
  toTransactionsInsightsApiError,
  transactionsInsightsORPCClient,
} from "@/features/finance/transactions-insights-orpc";

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
  const data = RecentMovementsResponseSchema.parse(
    await financeORPCClient.transactionsList({
      page: 1,
      pageSize: 5,
    }),
  );

  return data.data as Transaction[];
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  try {
    return StatsResponseSchema.parse(await transactionsInsightsORPCClient.stats({ from, to }));
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}
