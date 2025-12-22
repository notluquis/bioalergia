import { apiClient } from "@/lib/apiClient";
import type { ParticipantInsightResponse, ParticipantLeaderboardResponse } from "./types";

export async function fetchParticipantInsight(
  participantId: string,
  params?: { from?: string; to?: string }
): Promise<ParticipantInsightResponse> {
  const data = await apiClient.get<ParticipantInsightResponse & { status: string; message?: string }>(
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
  to?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
}): Promise<ParticipantLeaderboardResponse> {
  const data = await apiClient.get<ParticipantLeaderboardResponse & { status: string; message?: string }>(
    "/api/transactions/participants",
    { query: params }
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "No se pudo obtener la información del participante");
  }
  return data;
}
