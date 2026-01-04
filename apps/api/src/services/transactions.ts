import { db } from "@finanzas/db";

export type TransactionFilters = {
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  status?: string;
  transactionType?: string;
  description?: string;
  externalReference?: string;
  sourceId?: string;
};

export async function listTransactions(
  filters: TransactionFilters,
  limit = 100,
  offset = 0
) {
  const where: any = {};

  if (filters.from || filters.to) {
    where.transactionDate = {};
    if (filters.from) where.transactionDate.gte = filters.from;
    if (filters.to) where.transactionDate.lte = filters.to;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.transactionAmount = {};
    if (filters.minAmount !== undefined)
      where.transactionAmount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined)
      where.transactionAmount.lte = filters.maxAmount;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.transactionType) {
    where.transactionType = filters.transactionType;
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.externalReference) {
    where.externalReference = {
      contains: filters.externalReference,
      mode: "insensitive",
    };
  }

  if (filters.sourceId) {
    where.sourceId = { contains: filters.sourceId, mode: "insensitive" };
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { externalReference: { contains: filters.search, mode: "insensitive" } },
      { paymentMethod: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, transactions };
}

export async function getTransactionById(id: number) {
  return await db.transaction.findUnique({
    where: { id },
  });
}

export async function createTransaction(data: any) {
  return await db.transaction.create({
    data,
  });
}

export async function createTransactionsBatch(data: any[]) {
  return await db.transaction.createMany({
    data,
    skipDuplicates: true,
  });
}
