import { z } from "zod";
import { financeTransactionsResponseSchema } from "@finanzas/orpc-contracts/finance";
import { transactionsInsightsStatsResponseSchema } from "@finanzas/orpc-contracts/transactions-insights";
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

const StatsResponseSchema = z.object({
  byType: z.array(
    z.object({
      description: z.string().nullable(),
      direction: z.enum(["IN", "NEUTRO", "OUT"]),
      total: z.number(),
    })
  ),
  monthly: z.array(
    z.object({
      in: z.number(),
      month: z.string(),
      net: z.number(),
      out: z.number(),
    })
  ),
  totals: z.record(z.string(), z.number()),
});

export async function fetchRecentMovements(): Promise<Transaction[]> {
  // The oRPC contract returns `amount` / `date` / `type`, NOT the legacy
  // `transactionAmount` / `transactionDate` / `transactionType` shape the
  // widget consumes. Map explicitly — a blind cast left every row at $0.
  const res = financeTransactionsResponseSchema.parse(
    await financeORPCClient.transactionsList({
      page: 1,
      pageSize: 5,
    })
  );

  return res.data.map((t) => ({
    description: t.description,
    externalReference: null,
    id: t.id,
    paymentMethod: t.settlementPaymentMethod ?? t.releasePaymentMethod ?? null,
    // `amount` is signed in the DB, but sign defensively by type so the
    // amount color (success/danger) is always correct.
    settlementNetAmount: null,
    sourceId: t.sourceId ?? null,
    status: null,
    transactionAmount: t.type === "EXPENSE" ? -Math.abs(t.amount) : Math.abs(t.amount),
    transactionDate: t.date,
    transactionType: t.type === "EXPENSE" ? "Egreso" : "Ingreso",
  }));
}

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  try {
    return StatsResponseSchema.parse(
      transactionsInsightsStatsResponseSchema.parse(
        // Home dashboard spans 30 days — bucket per day so the activity chart
        // shows real daily movement instead of 1–2 month-wide blocks.
        await transactionsInsightsORPCClient.stats({ from, granularity: "day", to })
      )
    );
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}
