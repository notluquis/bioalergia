import { queryOptions } from "@tanstack/react-query";

import { fetchParticipantInsight, fetchParticipantLeaderboard } from "./api";

export type LeaderboardParams = {
  from?: string;
  to?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
};

export type ParticipantDetailParams = {
  participantId: string;
  from?: string;
  to?: string;
};

export const participantKeys = {
  all: ["participants"] as const,
  leaderboard: (params: LeaderboardParams) => ["participants", "leaderboard", params] as const,
  detail: (params: ParticipantDetailParams) => ["participants", "detail", params] as const,
};

export const participantQueries = {
  leaderboard: (params: LeaderboardParams) =>
    queryOptions({
      queryKey: participantKeys.leaderboard(params),
      queryFn: () => fetchParticipantLeaderboard(params),
      staleTime: 5 * 60 * 1000,
    }),
  detail: (params: ParticipantDetailParams) =>
    queryOptions({
      queryKey: participantKeys.detail(params),
      queryFn: () => fetchParticipantInsight(params.participantId, { from: params.from, to: params.to }),
      enabled: Boolean(params.participantId),
      staleTime: 5 * 60 * 1000,
    }),
};
