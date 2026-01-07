import { useCountTransaction, useFindManyTransaction } from "@finanzas/db/hooks";
import dayjs from "dayjs";

import type { TransactionsApiResponse, TransactionsQueryParams } from "../api";
// import type { Prisma } from "@prisma/client"; // Unused for now

// Helper to construct Prisma WhereInput from filters
function buildWhereInput(filters: TransactionsQueryParams["filters"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.from || filters.to) {
    where.transactionDate = {};
    if (filters.from) where.transactionDate.gte = dayjs(filters.from).startOf("day").toISOString();
    if (filters.to) where.transactionDate.lte = dayjs(filters.to).endOf("day").toISOString();
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.sourceId) {
    where.sourceId = filters.sourceId;
  }

  if (filters.externalReference) {
    where.externalReference = { contains: filters.externalReference, mode: "insensitive" };
  }

  if (filters.transactionType) {
    where.transactionType = filters.transactionType;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.bankAccountNumber) {
    where.bankAccount = { contains: filters.bankAccountNumber };
  }

  // Exclude test transactions by default (unless explicitly requested)
  if (!filters.includeTest) {
    where.AND = where.AND || [];
    where.AND.push({
      NOT: {
        OR: [
          { description: { contains: "test", mode: "insensitive" } },
          { sourceId: { contains: "test", mode: "insensitive" } },
          { externalReference: { contains: "test", mode: "insensitive" } },
        ],
      },
    });
  }

  return where;
}

export function useTransactionsQuery(params: TransactionsQueryParams) {
  const { page, pageSize, filters } = params;
  const where = buildWhereInput(filters);

  // 1. Fetch Data
  // 1. Fetch Data
  const {
    data: transactions,
    isPending: isPendingData,
    isFetching: isFetchingData,
    error: errorData,
  } = useFindManyTransaction({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { transactionDate: "desc" },
    include: {
      people: true, // Assuming we need relations
    },
  });

  // 2. Fetch Count
  const { data: count, isPending: isPendingCount } = useCountTransaction({ where });

  // 3. Combine
  const isLoading = isPendingData || isPendingCount;
  const isFetching = isFetchingData;

  const result: TransactionsApiResponse = {
    status: errorData ? "error" : "ok",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (transactions as any[]) || [], // Type cast if necessary until shared types
    total: count || 0,
    page,
    pageSize,
    hasAmounts: filters.includeAmounts, // Just echoing back
    message: errorData ? errorData.message : undefined,
  };

  return {
    data: result,
    isPending: isLoading,
    isFetching,
    error: errorData,
    refetch: () => {
      // We can't easily refetch both cleanly with one function in this pattern
      // without wrapper, but strictly speaking UI calls refetch.
      // For now, we rely on QueryClient invalidation or auto-refetch.
    },
  };
}
