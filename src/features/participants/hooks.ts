import { keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { fetchParticipantLeaderboard } from "./api";
import type { ParticipantLeaderboardResponse, ParticipantSummaryRow } from "./types";
import { queryKeys } from "../../lib/queryKeys";

type LeaderboardParams = {
  from?: string;
  to?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
};

export function useParticipantLeaderboardQuery(
  params: LeaderboardParams,
  options?: Pick<UseQueryOptions<ParticipantLeaderboardResponse, Error, ParticipantSummaryRow[]>, "enabled">
) {
  return useQuery<ParticipantLeaderboardResponse, Error, ParticipantSummaryRow[]>({
    queryKey: queryKeys.participants.leaderboard(params),
    queryFn: () => fetchParticipantLeaderboard(params),
    select: (response) => response.participants,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}
