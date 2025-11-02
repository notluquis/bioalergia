import type { ParticipantInsightResponse, ParticipantLeaderboardResponse } from "./types";

async function handleResponse<T extends { status: string }>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok || data.status !== "ok") {
    throw new Error(data.message || "No se pudo obtener la información del participante");
  }
  return data as T;
}

export async function fetchParticipantInsight(
  participantId: string,
  params?: { from?: string; to?: string }
): Promise<ParticipantInsightResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const query = search.toString();
  const res = await fetch(
    `/api/transactions/participants/${encodeURIComponent(participantId)}${query ? `?${query}` : ""}`,
    {
      credentials: "include",
    }
  );
  return handleResponse<ParticipantInsightResponse>(res);
}

export async function fetchParticipantLeaderboard(params?: {
  from?: string;
  to?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
}): Promise<ParticipantLeaderboardResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.mode) search.set("mode", params.mode);
  const query = search.toString();
  const res = await fetch(`/api/transactions/participants${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  return handleResponse<ParticipantLeaderboardResponse>(res);
}
