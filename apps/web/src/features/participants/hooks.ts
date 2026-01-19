import { keepPreviousData, type UseQueryOptions, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchParticipantLeaderboard } from "./api";
import type { ParticipantLeaderboardResponse, ParticipantSummaryRow } from "./types";

interface LeaderboardParams {
  from?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
  to?: string;
}

export function useParticipantLeaderboardQuery(
  params: LeaderboardParams,
  options?: Pick<
    UseQueryOptions<ParticipantLeaderboardResponse, Error, ParticipantSummaryRow[]>,
    "enabled"
  >,
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
