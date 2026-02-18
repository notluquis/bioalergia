import type { TransactionSource, TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import { fetchMergedTransactions } from "./transactions";

export type CreateFinancialTransactionInput = {
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId?: number;
  comment?: string;
  source?: TransactionSource;
  sourceId?: string;
};

export type UpdateFinancialTransactionInput = {
  date?: Date;
  description?: string;
  amount?: number;
  type?: TransactionType;
  categoryId?: number | null;
  comment?: string | null;
};

export async function syncFinancialTransactions(_userId: number) {
  // 1. Fetch all unified transactions from MP (Settlements, Releases, Withdraws)
  const unifiedTransactions = await fetchMergedTransactions({
    includeTest: false,
  });

  let createdCount = 0;

  for (const tour of unifiedTransactions) {
    // All MP-sourced transactions map to MERCADOPAGO source
    const source: TransactionSource = "MERCADOPAGO";

    // Check if already synced (idempotent via sourceId)
    if (tour.sourceId) {
      const existing = await db.financialTransaction.findFirst({
        where: { sourceId: tour.sourceId },
      });
      if (existing) continue;
    }

    const type: TransactionType = tour.transactionAmount >= 0 ? "INCOME" : "EXPENSE";

    await db.financialTransaction.create({
      data: {
        date: tour.transactionDate,
        description: tour.description || "Sin descripcion",
        amount: new Decimal(tour.transactionAmount),
        type,
        source,
        sourceId: tour.sourceId ?? undefined,
        comment: tour.externalReference ? `Ref: ${tour.externalReference}` : undefined,
      },
    });
    createdCount++;
  }

  return { created: createdCount };
}

export async function listFinancialTransactions(params: {
  from?: Date;
  to?: Date;
  categoryId?: number;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const skip = (page - 1) * pageSize;

  const where: {
    date?: { gte?: Date; lte?: Date };
    categoryId?: number;
    type?: TransactionType;
    OR?: Array<{
      description?: { contains: string; mode: "insensitive" };
      comment?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = params.from;
    if (params.to) where.date.lte = params.to;
  }
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.type) where.type = params.type as TransactionType;
  if (params.search) {
    where.OR = [
      { description: { contains: params.search, mode: "insensitive" } },
      { comment: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [total, transactions] = await Promise.all([
    db.financialTransaction.count({ where }),
    db.financialTransaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data: transactions,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function createFinancialTransaction(data: CreateFinancialTransactionInput) {
  return db.financialTransaction.create({
    data: {
      date: data.date,
      description: data.description,
      amount: new Decimal(data.amount),
      type: data.type,
      source: data.source ?? "MANUAL",
      categoryId: data.categoryId,
      comment: data.comment,
      sourceId: data.sourceId,
    },
  });
}

export async function updateFinancialTransaction(
  id: number,
  data: UpdateFinancialTransactionInput,
) {
  return db.financialTransaction.update({
    where: { id },
    data: {
      ...(data.date !== undefined && { date: data.date }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: new Decimal(data.amount) }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.comment !== undefined && { comment: data.comment }),
    },
  });
}

export async function deleteFinancialTransaction(id: number) {
  return db.financialTransaction.delete({
    where: { id },
  });
}

export async function listTransactionCategories() {
  return db.transactionCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createTransactionCategory(data: {
  name: string;
  type: TransactionType;
  color?: string;
}) {
  return db.transactionCategory.create({ data });
}
