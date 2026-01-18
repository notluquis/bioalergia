import { apiClient } from "@/lib/apiClient";

import type { ParticipantInsightResponse, ParticipantLeaderboardResponse } from "./types";

export async function fetchParticipantInsight(
  participantId: string,
  params?: { from?: string; to?: string }
): Promise<ParticipantInsightResponse> {
  const data = await apiClient.get<ParticipantInsightResponse & { message?: string; status: string }>(
    `/api/transactions/participants/${encodeURIComponent(participantId)}`,
    { query: params }
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "No se pudo obtener la información del participante");
  }
  return data;
}

export async function fetchParticipantLeaderboard(params?: {
  from?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
  to?: string;
}): Promise<ParticipantLeaderboardResponse> {
  const data = await apiClient.get<ParticipantLeaderboardResponse & { message?: string; status: string }>(
    "/api/transactions/participants",
    { query: params }
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "No se pudo obtener la información del participante");
  }
  return data;
}
