/**
 * Statistics API
 */

import {
  transactionsInsightsParticipantsResponseSchema,
  transactionsInsightsStatsResponseSchema,
} from "@finanzas/orpc-contracts";
import {
  toTransactionsInsightsApiError,
  transactionsInsightsORPCClient,
} from "../transactions-insights-orpc";
import { StatsResponseSchema, TopParticipantsResponseSchema } from "./schemas";
import type { StatsResponse, TopParticipantData } from "./types";

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  try {
    return StatsResponseSchema.parse(
      transactionsInsightsStatsResponseSchema.parse(
        await transactionsInsightsORPCClient.stats({ from, to })
      )
    );
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}

export async function fetchTopParticipants(
  from: string,
  to: string,
  limit = 5
): Promise<TopParticipantData[]> {
  try {
    const response = transactionsInsightsParticipantsResponseSchema.parse(
      await transactionsInsightsORPCClient.participants({ from, limit, to })
    );

    return TopParticipantsResponseSchema.parse(response).data ?? [];
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}
