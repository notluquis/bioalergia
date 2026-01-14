import type { ReleaseTransaction } from "@finanzas/db/models";

import { apiClient } from "@/lib/apiClient";

interface FetchReleaseTransactionsParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  descriptions?: string[];
  search?: string;
}

interface FetchReleaseTransactionsResponse {
  status: "ok";
  data: ReleaseTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchReleaseTransactions(
  params: FetchReleaseTransactionsParams
): Promise<FetchReleaseTransactionsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.search) searchParams.set("search", params.search);
  if (params.descriptions?.length) searchParams.set("descriptions", params.descriptions.join(","));

  return apiClient.get<FetchReleaseTransactionsResponse>(`api/release-transactions?${searchParams.toString()}`);
}
