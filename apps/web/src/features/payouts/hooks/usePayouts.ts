import { useSuspenseQuery } from "@tanstack/react-query";

import { payoutKeys } from "../queries";

export function usePayouts() {
  const { data } = useSuspenseQuery(payoutKeys.list());

  return {
    payouts: data.data,
    total: data.total,
    page: data.page,
    totalPages: data.totalPages,
    refresh: async () => {}, // Handled by standard query invalidation if needed
  };
}
