import {
  releaseTransactionsORPCClient,
  toReleaseTransactionsApiError,
} from "@/features/finance/release-transactions-orpc";
import { compactORPCInput } from "@/lib/orpc-input";

interface FetchReleaseTransactionsParams {
  descriptions?: string[];
  from?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  to?: string;
}

export async function fetchReleaseTransactions(params: FetchReleaseTransactionsParams) {
  try {
    return await releaseTransactionsORPCClient.list(
      compactORPCInput({
        descriptions: params.descriptions?.join(","),
        from: params.from,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        to: params.to,
      }) ?? {}
    );
  } catch (error) {
    throw toReleaseTransactionsApiError(error);
  }
}
