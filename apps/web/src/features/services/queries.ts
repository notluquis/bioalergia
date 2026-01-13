import { queryOptions } from "@tanstack/react-query";

import { fetchServiceDetail, fetchServices } from "./api";
import type { ServicesFilterState } from "./types";

export const serviceKeys = {
  all: ["services"] as const,
  lists: () => [...serviceKeys.all, "list"] as const,
  list: (filters: ServicesFilterState) => [...serviceKeys.lists(), { filters }] as const,
  details: () => [...serviceKeys.all, "detail"] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  // For aggregated details (legacy pattern support)
  detailsAggregated: (ids: string) => [...serviceKeys.details(), "aggregated", { ids }] as const,
};

export const serviceQueries = {
  list: (enabled = true) =>
    queryOptions({
      queryKey: serviceKeys.lists(),
      queryFn: fetchServices,
      enabled,
    }),

  detail: (publicId: string, enabled = true) =>
    queryOptions({
      queryKey: serviceKeys.detail(publicId),
      queryFn: () => fetchServiceDetail(publicId),
      enabled: enabled && !!publicId,
    }),
};
