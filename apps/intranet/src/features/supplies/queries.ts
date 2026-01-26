import { queryOptions } from "@tanstack/react-query";

import { getCommonSupplies, getSupplyRequests } from "./api";

export const supplyKeys = {
  all: ["supplies"] as const,
  common: () => [...supplyKeys.all, "common"] as const,
  requests: () => [...supplyKeys.all, "requests"] as const,
};

export const supplyQueries = {
  common: () =>
    queryOptions({
      queryFn: getCommonSupplies,
      queryKey: supplyKeys.common(),
    }),
  requests: () =>
    queryOptions({
      queryFn: getSupplyRequests,
      queryKey: supplyKeys.requests(),
    }),
};
