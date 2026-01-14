import { queryOptions } from "@tanstack/react-query";

import { getCommonSupplies, getSupplyRequests } from "./api";

export const supplyKeys = {
  all: ["supplies"] as const,
  requests: () => [...supplyKeys.all, "requests"] as const,
  common: () => [...supplyKeys.all, "common"] as const,
};

export const supplyQueries = {
  requests: () =>
    queryOptions({
      queryKey: supplyKeys.requests(),
      queryFn: getSupplyRequests,
    }),
  common: () =>
    queryOptions({
      queryKey: supplyKeys.common(),
      queryFn: getCommonSupplies,
    }),
};
