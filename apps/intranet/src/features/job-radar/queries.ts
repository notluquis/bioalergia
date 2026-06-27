import { queryOptions } from "@tanstack/react-query";
import { jobRadarORPCClient } from "./orpc";

export type JobRadarListFilters = NonNullable<Parameters<typeof jobRadarORPCClient.list>[0]>;

export const jobRadarKeys = {
  all: ["job-radar"] as const,
  filterOptions: (filters: JobRadarListFilters) =>
    [...jobRadarKeys.all, "filter-options", filters] as const,
  list: (filters: JobRadarListFilters) => [...jobRadarKeys.all, "list", filters] as const,
  settings: () => [...jobRadarKeys.all, "settings"] as const,
  sources: () => [...jobRadarKeys.all, "sources"] as const,
};

export const jobRadarQueries = {
  list: (filters: JobRadarListFilters = {}) =>
    queryOptions({
      queryKey: jobRadarKeys.list(filters),
      queryFn: () => jobRadarORPCClient.list(filters),
    }),
  filterOptions: (filters: JobRadarListFilters = {}) =>
    queryOptions({
      queryKey: jobRadarKeys.filterOptions(filters),
      queryFn: () => jobRadarORPCClient.filterOptions(filters),
    }),
  settings: () =>
    queryOptions({
      queryKey: jobRadarKeys.settings(),
      queryFn: () => jobRadarORPCClient.getSettings(),
    }),
  sources: () =>
    queryOptions({
      queryKey: jobRadarKeys.sources(),
      queryFn: () => jobRadarORPCClient.listSources(),
    }),
};
