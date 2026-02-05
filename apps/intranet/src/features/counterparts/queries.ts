import { queryOptions } from "@tanstack/react-query";

import { fetchCounterpart, fetchCounterpartSummary } from "./api";

export const counterpartKeys = {
  all: ["counterpart"] as const,
  detail: (id: number) =>
    queryOptions({
      enabled: Boolean(id),
      queryFn: () => fetchCounterpart(id),
      queryKey: ["counterpart-detail", id],
    }),
  lists: () => [...counterpartKeys.all, "list"] as const,
  summary: (id: number, range: { from: string; to: string }) =>
    queryOptions({
      enabled: Boolean(id),
      queryFn: () => fetchCounterpartSummary(id, range),
      queryKey: ["counterpart-summary", id, range],
    }),
};

// Note: Counterparts page uses ZenStack useFindManyCounterpart hook directly
// For loader, we'll use the DB query approach
export const counterpartQueries = {
  list: () =>
    queryOptions({
      queryFn: async () => {
        // This will be handled by ZenStack in the component
        // For now, return empty array to avoid breaking loader
        return [];
      },
      queryKey: counterpartKeys.lists(),
    }),
};
