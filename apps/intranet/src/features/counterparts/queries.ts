import { queryOptions } from "@tanstack/react-query";

import { fetchCounterpart, fetchCounterpartSummary, fetchCounterparts } from "./api";

export const counterpartKeys = {
  all: ["counterpart"] as const,
  // Hierarchical under `all` so invalidateQueries(counterpartKeys.all) cascades
  // to list + detail + summary (prefix match). For per-id invalidation use the
  // prefix [...all, "detail" | "summary", id].
  details: (id: number) => [...counterpartKeys.all, "detail", id] as const,
  detail: (id: number) =>
    queryOptions({
      enabled: Boolean(id),
      queryFn: () => fetchCounterpart(id),
      queryKey: counterpartKeys.details(id),
    }),
  lists: () => [...counterpartKeys.all, "list"] as const,
  summaries: (id: number) => [...counterpartKeys.all, "summary", id] as const,
  summary: (id: number, range: { from: string; to: string }) =>
    queryOptions({
      enabled: Boolean(id),
      queryFn: () => fetchCounterpartSummary(id, range),
      queryKey: [...counterpartKeys.summaries(id), range] as const,
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
