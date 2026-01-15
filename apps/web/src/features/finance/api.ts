import { apiClient } from "@/lib/apiClient";

import type { ListResponse as ReleaseListResponse } from "./releases/types";
import type { ListResponse as SettlementListResponse } from "./settlements/types";
import type { Transaction } from "./types";

export type FetchTransactionsParams = {
  filters: {
    from?: string;
    to?: string;
    description?: string;
    origin?: string;
    destination?: string;
    sourceId?: string;
    bankAccountNumber?: string;
    direction?: string;
    includeAmounts?: boolean;
    externalReference?: string;
    transactionType?: string;
    status?: string;
    paymentMethod?: string;
    search?: string;
  };
  page: number;
  pageSize: number;
};

export type TransactionsResponse = {
  status: "ok" | "error";
  data: Transaction[];
  total?: number;
  totalPages?: number;
  page?: number;
  pageSize?: number;
};

export async function fetchTransactions({ filters, page, pageSize }: FetchTransactionsParams) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.description) params.set("description", filters.description); // Search likely covers this
  if (filters.transactionType) params.set("transactionType", filters.transactionType);
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters.search) params.set("search", filters.search);
  if (filters.includeAmounts) params.set("includeAmounts", "true");

  // Map filters to API params
  // API supports: from, to, origin, destination, paymentMethod, transactionType, status, search, includeAmounts
  // Not all frontend filters might be supported by backend, but we map common ones.

  const res = await apiClient.get<TransactionsResponse>(`/api/transactions?${params.toString()}`);
  return res;
}

export async function fetchReleaseTransactions(page: number, pageSize: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  return apiClient.get<ReleaseListResponse>(`/api/release-transactions?${params.toString()}`);
}

export async function fetchSettlementTransactions(page: number, pageSize: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  return apiClient.get<SettlementListResponse>(`/api/settlement-transactions?${params.toString()}`);
}
