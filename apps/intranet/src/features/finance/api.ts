import { apiClient } from "@/lib/api-client";

import type { ListResponse as ReleaseListResponse } from "./releases/types";
import {
  ReleaseTransactionsResponseSchema,
  SettlementTransactionsResponseSchema,
  TransactionsResponseSchema,
} from "./schemas";
import type { ListResponse as SettlementListResponse } from "./settlements/types";
import type { Transaction } from "./types";

export interface FetchTransactionsParams {
  filters: {
    bankAccountNumber?: string;
    description?: string;
    destination?: string;
    direction?: string;
    externalReference?: string;
    from?: string;
    includeAmounts?: boolean;
    origin?: string;
    paymentMethod?: string;
    search?: string;
    sourceId?: string;
    status?: string;
    to?: string;
    transactionType?: string;
  };
  includeTotal?: boolean;
  page: number;
  pageSize: number;
}

export interface TransactionsResponse {
  data: Transaction[];
  hasAmounts?: boolean;
  page?: number;
  pageSize?: number;
  status: "error" | "ok";
  total?: number;
  totalPages?: number;
}

export async function fetchReleaseTransactions(page: number, pageSize: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }

  return apiClient.get<ReleaseListResponse>(`/api/release-transactions?${params.toString()}`, {
    responseSchema: ReleaseTransactionsResponseSchema,
  });
}

export async function fetchSettlementTransactions(page: number, pageSize: number, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) {
    params.set("search", search);
  }

  return apiClient.get<SettlementListResponse>(
    `/api/settlement-transactions?${params.toString()}`,
    {
      responseSchema: SettlementTransactionsResponseSchema,
    },
  );
}

export async function fetchTransactions({
  filters,
  includeTotal = true,
  page,
  pageSize,
}: FetchTransactionsParams) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.bankAccountNumber) {
    params.set("bankAccountNumber", filters.bankAccountNumber);
  }
  if (filters.description) {
    params.set("description", filters.description); // Search likely covers this
  }
  if (filters.transactionType) {
    params.set("transactionType", filters.transactionType);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.paymentMethod) {
    params.set("paymentMethod", filters.paymentMethod);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.includeAmounts) {
    params.set("includeAmounts", "true");
  }
  if (!includeTotal) {
    params.set("includeTotal", "false");
  }

  // Map filters to API params
  // API supports: from, to, origin, destination, paymentMethod, transactionType, status, search, includeAmounts
  // Not all frontend filters might be supported by backend, but we map common ones.

  const res = await apiClient.get<TransactionsResponse>(`/api/transactions?${params.toString()}`, {
    responseSchema: TransactionsResponseSchema,
  });
  return res;
}
