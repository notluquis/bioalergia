import type { ReleaseTransaction } from "@finanzas/db/models";

import { z } from "zod";
import { apiClient } from "@/lib/api-client";

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
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.search) searchParams.set("search", params.search);
  if (params.descriptions?.length) searchParams.set("descriptions", params.descriptions.join(","));

  return apiClient.get<FetchReleaseTransactionsResponse>(
    `/api/release-transactions?${searchParams.toString()}`,
    { responseSchema: FetchReleaseTransactionsResponseSchema },
  );
}
