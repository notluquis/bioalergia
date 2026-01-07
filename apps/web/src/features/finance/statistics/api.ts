/**
 * Statistics API
 */

import { apiClient } from "@/lib/apiClient";

import type { StatsResponse, TopParticipantData } from "./types";

export async function fetchStats(from: string, to: string): Promise<StatsResponse> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiClient.get<StatsResponse>(`/api/transactions/stats?${params.toString()}`);
}

export async function fetchTopParticipants(from: string, to: string, limit = 5): Promise<TopParticipantData[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", String(limit));

  const response = await apiClient.get<{ data: TopParticipantData[] }>(
    `/api/transactions/participants?${params.toString()}`
  );

  return response.data ?? [];
}
