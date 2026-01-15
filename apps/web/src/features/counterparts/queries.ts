import { queryOptions } from "@tanstack/react-query";

import { fetchCounterpart, fetchCounterpartSummary } from "./api";

export const counterpartKeys = {
  all: ["counterpart"] as const,
  lists: () => [...counterpartKeys.all, "list"] as const,
  detail: (id: number) =>
    queryOptions({
      queryKey: ["counterpart-detail", id],
      queryFn: () => fetchCounterpart(id),
      enabled: !!id,
    }),
  summary: (id: number, range: { from: string; to: string }) =>
    queryOptions({
      queryKey: ["counterpart-summary", id, range],
      queryFn: () => fetchCounterpartSummary(id, range),
      enabled: !!id,
    }),
};

// Note: Counterparts page uses ZenStack useFindManyCounterpart hook directly
// For loader, we'll use the DB query approach
export const counterpartQueries = {
  list: () =>
    queryOptions({
      queryKey: counterpartKeys.lists(),
      queryFn: async () => {
        // This will be handled by ZenStack in the component
        // For now, return empty array to avoid breaking loader
        return [];
      },
    }),
};
