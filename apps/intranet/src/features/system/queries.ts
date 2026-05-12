import { queryOptions } from "@tanstack/react-query";
import { fetchRailwayDeployments, fetchSystemHealth } from "./api";

export const systemKeys = {
  all: ["system"] as const,
  deployments: () => ["system", "deployments"] as const,
  health: () => ["system", "health"] as const,
};

export const systemQueries = {
  deployments: () =>
    queryOptions({
      queryFn: () => fetchRailwayDeployments(),
      queryKey: systemKeys.deployments(),
      refetchInterval: 15_000,
      staleTime: 10_000,
    }),
  health: () =>
    queryOptions({
      queryFn: () => fetchSystemHealth(),
      queryKey: systemKeys.health(),
      staleTime: 30_000,
    }),
};
