import { queryOptions } from "@tanstack/react-query";
import { fetchServiceDetail, fetchServices } from "./api";
import type { ServicesFilterState } from "./types";

export const serviceKeys = {
  all: ["services"] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  details: () => [...serviceKeys.all, "detail"] as const,
  // For aggregated details (legacy pattern support)
  detailsAggregated: (ids: string) => [...serviceKeys.details(), "aggregated", { ids }] as const,
  list: (filters: ServicesFilterState) => [...serviceKeys.lists(), { filters }] as const,
  lists: () => [...serviceKeys.all, "list"] as const,
};

export const serviceQueries = {
  detail: (publicId: string, enabled = true) =>
    queryOptions({
      enabled: enabled && Boolean(publicId),
      queryFn: () => fetchServiceDetail(publicId),
      queryKey: serviceKeys.detail(publicId),
    }),

  list: (enabled = true) =>
    queryOptions({
      enabled,
      queryFn: fetchServices,
      queryKey: serviceKeys.lists(),
    }),
};
