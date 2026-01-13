import { useFindManyReleaseTransaction } from "@finanzas/db/hooks";
import type { ReleaseTransaction } from "@finanzas/db/models";

export function usePayouts() {
  const query = useFindManyReleaseTransaction({
    where: {
      OR: [{ description: "payout" }, { description: "payout_cash" }],
    },
    orderBy: {
      date: "desc",
    },
  });

  return {
    payouts: (query.data ?? []) as ReleaseTransaction[],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
