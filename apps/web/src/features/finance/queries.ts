import { queryOptions } from "@tanstack/react-query";

import { fetchReleaseTransactions, fetchSettlementTransactions } from "./api";

export const financeKeys = {
  all: ["finance"] as const,
  releases: (page: number, pageSize: number, search?: string) =>
    queryOptions({
      queryKey: ["release-transactions", page, pageSize, search],
      queryFn: () => fetchReleaseTransactions(page, pageSize, search),
    }),
  settlements: (page: number, pageSize: number, search?: string) =>
    queryOptions({
      queryKey: ["settlement-transactions", page, pageSize, search],
      queryFn: () => fetchSettlementTransactions(page, pageSize, search),
    }),
};
