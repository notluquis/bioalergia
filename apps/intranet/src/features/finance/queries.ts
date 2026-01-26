import { queryOptions } from "@tanstack/react-query";

import { fetchReleaseTransactions, fetchSettlementTransactions } from "./api";

export const financeKeys = {
  all: ["finance"] as const,
  releases: (page: number, pageSize: number, search?: string) =>
    queryOptions({
      queryFn: () => fetchReleaseTransactions(page, pageSize, search),
      queryKey: ["release-transactions", page, pageSize, search],
    }),
  settlements: (page: number, pageSize: number, search?: string) =>
    queryOptions({
      queryFn: () => fetchSettlementTransactions(page, pageSize, search),
      queryKey: ["settlement-transactions", page, pageSize, search],
    }),
};
