import { queryOptions } from "@tanstack/react-query";

import { fetchStats, fetchTopParticipants } from "./api";

export const statsKeys = {
  all: ["finance-stats"] as const,
  main: (from: string, to: string) =>
    queryOptions({
      queryKey: ["finance-stats", { from, to }],
      queryFn: () => fetchStats(from, to),
    }),
  participants: (from: string, to: string) =>
    queryOptions({
      queryKey: ["top-participants", { from, to }],
      queryFn: () => fetchTopParticipants(from, to, 10),
    }),
};
