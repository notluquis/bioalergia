import { queryOptions } from "@tanstack/react-query";

import * as api from "./api";

const defaultFilter = { includeInactive: false };

export const employeeKeys = {
  all: ["employees"] as const,
  list: (filters: { includeInactive: boolean } = defaultFilter) =>
    queryOptions({
      queryKey: ["employees", "list", filters],
      queryFn: () => api.fetchEmployees(filters.includeInactive),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: ["employees", "detail", id],
      queryFn: () => Promise.resolve(null), // Placeholder if we need individual fetch later
    }),
};
