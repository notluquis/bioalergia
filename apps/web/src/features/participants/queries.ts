import { queryOptions } from "@tanstack/react-query";

import { fetchParticipantInsight, fetchParticipantLeaderboard } from "./api";

export interface LeaderboardParams {
  from?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
  to?: string;
}

export interface ParticipantDetailParams {
  from?: string;
  participantId: string;
  to?: string;
}

export const participantKeys = {
  all: ["participants"] as const,
  detail: (params: ParticipantDetailParams) => ["participants", "detail", params] as const,
  leaderboard: (params: LeaderboardParams) => ["participants", "leaderboard", params] as const,
};

export const participantQueries = {
  detail: (params: ParticipantDetailParams) =>
    queryOptions({
      enabled: Boolean(params.participantId),
      queryFn: () => fetchParticipantInsight(params.participantId, { from: params.from, to: params.to }),
      queryKey: participantKeys.detail(params),
      staleTime: 5 * 60 * 1000,
    }),
  leaderboard: (params: LeaderboardParams) =>
    queryOptions({
      queryFn: () => fetchParticipantLeaderboard(params),
      queryKey: participantKeys.leaderboard(params),
      staleTime: 5 * 60 * 1000,
    }),
};
