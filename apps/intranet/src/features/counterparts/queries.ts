import { queryOptions } from "@tanstack/react-query";

import { fetchCounterpart, fetchCounterpartSummary, fetchCounterparts } from "./api";

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

// Counterparts list now uses REST to trigger backend auto-sync by RUT.
export const counterpartQueries = {
  list: () =>
    queryOptions({
      queryFn: fetchCounterparts,
      queryKey: counterpartKeys.lists(),
    }),
};
