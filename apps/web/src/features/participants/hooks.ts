import { keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import type { ParticipantLeaderboardResponse, ParticipantSummaryRow } from "./types";

import { fetchParticipantLeaderboard } from "./api";

interface LeaderboardParams {
  from?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
  to?: string;
}

export function useParticipantLeaderboardQuery(
  params: LeaderboardParams,
  options?: Pick<UseQueryOptions<ParticipantLeaderboardResponse, Error, ParticipantSummaryRow[]>, "enabled">
) {
  return useQuery<ParticipantLeaderboardResponse, Error, ParticipantSummaryRow[]>({
    placeholderData: keepPreviousData,
    queryFn: () => fetchParticipantLeaderboard(params),
    queryKey: queryKeys.participants.leaderboard(params),
    select: (response) => response.participants,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}
