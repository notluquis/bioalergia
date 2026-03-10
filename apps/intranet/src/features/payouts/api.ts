import type { ReleaseTransaction } from "@finanzas/db/models";

import { z } from "zod";
import {
  releaseTransactionsORPCClient,
  toReleaseTransactionsApiError,
} from "@/features/finance/release-transactions-orpc";

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

const FetchReleaseTransactionsResponseSchema = z.object({
  data: z.array(z.unknown()),
  page: z.number(),
  pageSize: z.number(),
  status: z.literal("ok"),
  total: z.number(),
  totalPages: z.number(),
});

export async function fetchReleaseTransactions(
  params: FetchReleaseTransactionsParams,
): Promise<FetchReleaseTransactionsResponse> {
  try {
    return FetchReleaseTransactionsResponseSchema.parse(
      await releaseTransactionsORPCClient.list({
        descriptions: params.descriptions?.join(","),
        from: params.from,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        to: params.to,
      }),
    );
  } catch (error) {
    throw toReleaseTransactionsApiError(error);
  }
}
