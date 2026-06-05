import { queryOptions } from "@tanstack/react-query";
import { jobRadarORPCClient } from "./orpc";

export type JobRadarListFilters = NonNullable<Parameters<typeof jobRadarORPCClient.list>[0]>;

export const jobRadarKeys = {
  all: ["job-radar"] as const,
  list: (filters: JobRadarListFilters) => [...jobRadarKeys.all, "list", filters] as const,
};

export const jobRadarQueries = {
  list: (filters: JobRadarListFilters = {}) =>
    queryOptions({
      queryKey: jobRadarKeys.list(filters),
      queryFn: () => jobRadarORPCClient.list(filters),
    }),
};
