import { queryOptions } from "@tanstack/react-query";

import { fetchCalendarDaily } from "@/features/calendar/api";
import { diffDays } from "@/lib/dates";

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
  // Income breakdown for the financial dashboard. Derived from the calendar-daily
  // feed (events with amountPaid). queryKey shape ["financial-summary", from, to]
  // is preserved exactly so the moved key resolves identically.
  summary: (from: string, to: string) =>
    queryOptions({
      queryFn: () =>
        fetchCalendarDaily({
          categories: [],
          from,
          maxDays: Math.max(diffDays(to, from) + 1, 1),
          to,
        }),
      queryKey: ["financial-summary", from, to],
    }),
};
