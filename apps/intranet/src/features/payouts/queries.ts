import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { fetchReleaseTransactions } from "./api";

const PAYOUT_TYPES = ["payout", "payout_cash"];

export const payoutKeys = {
  all: ["payouts"] as const,
  list: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    queryOptions({
      placeholderData: keepPreviousData,
      queryFn: () =>
        fetchReleaseTransactions({
          ...params,
          descriptions: PAYOUT_TYPES,
        }),
      queryKey: ["payouts", "list", params],
    }),
};
