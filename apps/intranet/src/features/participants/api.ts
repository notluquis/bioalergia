import {
  transactionsInsightsParticipantInsightResponseSchema,
  transactionsInsightsParticipantsResponseSchema,
} from "@finanzas/orpc-contracts";
import {
  toTransactionsInsightsApiError,
  transactionsInsightsORPCClient,
} from "@/features/finance/transactions-insights-orpc";

import type { ParticipantInsightResponse, ParticipantLeaderboardResponse } from "./types";

export async function fetchParticipantInsight(
  participantId: string,
  params?: { from?: string; to?: string }
): Promise<ParticipantInsightResponse> {
  try {
    const data = transactionsInsightsParticipantInsightResponseSchema.parse(
      await transactionsInsightsORPCClient.participantInsight({
        from: params?.from,
        id: participantId,
        to: params?.to,
      })
    );

    if (data.status !== "ok") {
      throw new Error("No se pudo obtener la información del participante");
    }

    return data as ParticipantInsightResponse;
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
    const data = transactionsInsightsParticipantsResponseSchema.parse(
      await transactionsInsightsORPCClient.participants(params ?? {})
    );

    if (data.status !== "ok") {
      throw new Error("No se pudo obtener la información del participante");
    }

    return {
      participants: data.data.map((item: (typeof data.data)[number]) => ({
        bankAccountHolder: null,
        bankAccountNumber: null,
        bankAccountType: null,
        bankBranch: null,
        bankName: null,
        displayName: item.personName,
        identificationNumber: null,
        incomingAmount: 0,
        incomingCount: 0,
        outgoingAmount: 0,
        outgoingCount: 0,
        participant: item.personId,
        totalAmount: item.total,
        totalCount: item.count,
        withdrawId: null,
      })),
      status: data.status,
    };
  } catch (error) {
    throw toTransactionsInsightsApiError(error);
  }
}
