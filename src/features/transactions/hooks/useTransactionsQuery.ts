import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchTransactions, type TransactionsApiResponse, type TransactionsQueryParams } from "../api";

export function useTransactionsQuery(params: TransactionsQueryParams, enabled: boolean) {
  return useQuery<TransactionsApiResponse, Error>({
    queryKey: queryKeys.transactions.movements(params),
    queryFn: () => fetchTransactions(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}
