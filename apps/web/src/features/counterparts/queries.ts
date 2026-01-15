import { queryOptions } from "@tanstack/react-query";

import { fetchCounterpart, fetchCounterpartSummary } from "./api";

export const counterpartKeys = {
  all: ["counterpart"] as const,
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
