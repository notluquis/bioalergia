import { queryOptions } from "@tanstack/react-query";

import { fetchEmployees } from "./api";

const defaultFilter = { includeInactive: false };

export const employeeKeys = {
  all: ["employees"] as const,
  detail: (id: number) =>
    queryOptions({
      queryFn: () => Promise.resolve(null), // Placeholder if we need individual fetch later
      queryKey: ["employees", "detail", id],
    }),
  list: (filters: { includeInactive: boolean } = defaultFilter) =>
    queryOptions({
      queryFn: () => fetchEmployees(filters.includeInactive),
      queryKey: ["employees", "list", filters],
    }),
};
