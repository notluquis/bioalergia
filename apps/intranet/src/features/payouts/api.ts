import {
  releaseTransactionsORPCClient,
  toReleaseTransactionsApiError,
} from "@/features/finance/release-transactions-orpc";
import { ReleaseTransactionsResponseSchema } from "@/features/finance/schemas";
import type { ReleaseTransaction } from "@/features/finance/releases/types";
import { compactORPCInput } from "@/lib/orpc-input";

interface FetchReleaseTransactionsParams {
  descriptions?: string[];
  from?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  to?: string;
}

interface FetchReleaseTransactionsResponse {
  data: ReleaseTransaction[];
  page: number;
  pageSize: number;
  status: "ok";
  total: number;
  totalPages: number;
}

export async function fetchReleaseTransactions(
  params: FetchReleaseTransactionsParams
): Promise<FetchReleaseTransactionsResponse> {
  try {
    return ReleaseTransactionsResponseSchema.parse(
      await releaseTransactionsORPCClient.list(
        compactORPCInput({
          descriptions: params.descriptions?.join(","),
          from: params.from,
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          to: params.to,
        }) ?? {}
      )
    ) as unknown as FetchReleaseTransactionsResponse;
  } catch (error) {
    throw toReleaseTransactionsApiError(error);
  }
}
