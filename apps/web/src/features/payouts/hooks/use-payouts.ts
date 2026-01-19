import { useSuspenseQuery } from "@tanstack/react-query";

import { payoutKeys } from "../queries";

export function usePayouts() {
  const { data } = useSuspenseQuery(payoutKeys.list());

  return {
    page: data.page,
    payouts: data.data,
    refresh: async () => {}, // Handled by standard query invalidation if needed
    total: data.total,
    totalPages: data.totalPages,
  };
}
