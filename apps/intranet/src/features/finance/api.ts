import { financeORPCClient, toFinanceApiError } from "./orpc";
import {
  releaseTransactionsORPCClient,
  toReleaseTransactionsApiError,
} from "./release-transactions-orpc";
import {
  ReleaseTransactionsResponseSchema,
  SettlementTransactionsResponseSchema,
  TransactionsResponseSchema,
} from "./schemas";
import { compactORPCInput } from "@/lib/orpc-input";
import {
  settlementTransactionsORPCClient,
  toSettlementTransactionsApiError,
} from "./settlement-transactions-orpc";
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
  try {
    return ReleaseTransactionsResponseSchema.parse(
      await releaseTransactionsORPCClient.list(
        compactORPCInput({
          page,
          pageSize,
          search,
        }) ?? {}
      )
    );
  } catch (error) {
    throw toReleaseTransactionsApiError(error);
  }
}

export async function fetchSettlementTransactions(page: number, pageSize: number, search?: string) {
  try {
    return SettlementTransactionsResponseSchema.parse(
      await settlementTransactionsORPCClient.list(
        compactORPCInput({
          page,
          pageSize,
          search,
        }) ?? {}
      )
    );
  } catch (error) {
    throw toSettlementTransactionsApiError(error);
  }
}

export async function fetchTransactions({
  filters,
  includeTotal = true,
  page,
  pageSize,
}: FetchTransactionsParams) {
  try {
    return TransactionsResponseSchema.parse(
      await financeORPCClient.transactionsList(
        compactORPCInput({
          from: filters.from,
          page,
          pageSize,
          search: filters.search ?? filters.description,
          to: filters.to,
          type:
            filters.transactionType === "INCOME" || filters.transactionType === "EXPENSE"
              ? filters.transactionType
              : undefined,
        }) ?? {}
      )
    );
  } catch (error) {
    if (
      !includeTotal ||
      filters.includeAmounts ||
      filters.bankAccountNumber ||
      filters.paymentMethod
    ) {
      // Legacy wrapper flags remain tolerated even though the oRPC contract doesn't expose them.
    }
    throw toFinanceApiError(error);
  }
}
