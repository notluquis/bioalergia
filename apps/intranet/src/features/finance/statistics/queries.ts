import { queryOptions } from "@tanstack/react-query";

import { fetchStats, fetchTopParticipants } from "./api";

export const statsKeys = {
  all: ["finance-stats"] as const,
  main: (from: string, to: string) =>
    queryOptions({
      queryFn: () => fetchStats(from, to),
      queryKey: ["finance-stats", { from, to }],
    }),
  participants: (from: string, to: string) =>
    queryOptions({
      queryFn: () => fetchTopParticipants(from, to, 10),
      queryKey: ["top-participants", { from, to }],
    }),
};
