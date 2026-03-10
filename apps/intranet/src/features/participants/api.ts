import { z } from "zod";
import {
  toTransactionsInsightsApiError,
  transactionsInsightsORPCClient,
} from "@/features/finance/transactions-insights-orpc";

import type { ParticipantInsightResponse, ParticipantLeaderboardResponse } from "./types";

const ParticipantInsightResponseSchema = z.looseObject({
  message: z.string().optional(),
  status: z.string(),
});

const ParticipantLeaderboardResponseSchema = z.looseObject({
  message: z.string().optional(),
  status: z.string(),
});

export async function fetchParticipantInsight(
  participantId: string,
  params?: { from?: string; to?: string },
): Promise<ParticipantInsightResponse> {
  try {
    const data = ParticipantInsightResponseSchema.parse(
      await transactionsInsightsORPCClient.participantInsight({
        from: params?.from,
        id: participantId,
        to: params?.to,
      }),
    );

    if (data.status !== "ok") {
      throw new Error("No se pudo obtener la información del participante");
    }

    return data as unknown as ParticipantInsightResponse;
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}

export async function fetchParticipantLeaderboard(params?: {
  from?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
  to?: string;
}): Promise<ParticipantLeaderboardResponse> {
  try {
    const data = ParticipantLeaderboardResponseSchema.parse(
      await transactionsInsightsORPCClient.participants(params),
    );

    if (data.status !== "ok") {
      throw new Error("No se pudo obtener la información del participante");
    }

    if ("participants" in data && Array.isArray(data.participants)) {
      return data as unknown as ParticipantLeaderboardResponse;
    }

    return {
      participants: ("data" in data && Array.isArray(data.data) ? data.data : []) as
        | ParticipantLeaderboardResponse["participants"]
        | [],
      status: "ok",
    } as unknown as ParticipantLeaderboardResponse;
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}
