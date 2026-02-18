import type { TransactionSource, TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import { fetchMergedTransactions } from "./transactions";

export type CreateFinancialTransactionInput = {
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId?: number | null;
  counterpartId?: number | null;
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
  counterpartId?: number | null;
  comment?: string | null;
};

const NON_RUT_CHARS_REGEX = /[^0-9k]/gi;
const ACCOUNT_SPACES_REGEX = /\s+/g;
const LEADING_ZEROS_REGEX = /^0+/;

const normalizeRut = (value: null | string | undefined) => {
  if (!value) return "";
  return value.replace(NON_RUT_CHARS_REGEX, "").toUpperCase();
};

const normalizeAccount = (value: null | string | undefined) => {
  if (!value) return "";
  const compact = value.replace(ACCOUNT_SPACES_REGEX, "").toUpperCase();
  if (!compact) return "";
  const normalized = compact.replace(LEADING_ZEROS_REGEX, "");
  return normalized.length > 0 ? normalized : "0";
};

type CounterpartLookup = {
  byAccount: Map<string, number>;
  byRut: Map<string, number>;
};

async function buildCounterpartLookup(): Promise<CounterpartLookup> {
  const counterparts = await db.counterpart.findMany({
    select: {
      accounts: { select: { accountNumber: true } },
      id: true,
      identificationNumber: true,
    },
  });

  const byRut = new Map<string, number>();
  const byAccount = new Map<string, number>();

  for (const counterpart of counterparts) {
    const normalizedRut = normalizeRut(counterpart.identificationNumber);
    if (normalizedRut) {
      byRut.set(normalizedRut, counterpart.id);
    }

    for (const account of counterpart.accounts) {
      const normalizedAccount = normalizeAccount(account.accountNumber);
      if (normalizedAccount && !byAccount.has(normalizedAccount)) {
        byAccount.set(normalizedAccount, counterpart.id);
      }
    }
  }

  return { byAccount, byRut };
}

export async function syncFinancialTransactions(_userId: number) {
  // 1. Fetch all unified transactions from MP (Settlements, Releases, Withdraws)
  const unifiedTransactions = await fetchMergedTransactions({
    includeTest: false,
  });
  const counterpartLookup = await buildCounterpartLookup();

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const tour of unifiedTransactions) {
    // All MP-sourced transactions map to MERCADOPAGO source
    const source: TransactionSource = "MERCADOPAGO";
    const counterpartIdByRut = counterpartLookup.byRut.get(normalizeRut(tour.identificationNumber));
    const counterpartIdByAccount = counterpartLookup.byAccount.get(
      normalizeAccount(tour.bankAccountNumber),
    );
    const counterpartId = counterpartIdByRut ?? counterpartIdByAccount ?? null;

    try {
      // Check if already synced (idempotent via sourceId)
      if (tour.sourceId) {
        const existing = await db.financialTransaction.findFirst({
          where: { source, sourceId: tour.sourceId },
          select: { counterpartId: true, id: true },
        });
        if (existing) {
          if (existing.counterpartId == null && counterpartId != null) {
            await db.financialTransaction.update({
              where: { id: existing.id },
              data: { counterpartId },
            });
          }
          duplicateCount++;
          continue;
        }
      } else {
        // Fallback dedupe for rows without sourceId.
        const existing = await db.financialTransaction.findFirst({
          where: {
            amount: tour.transactionAmount,
            date: tour.transactionDate,
            description: tour.description || "Sin descripcion",
            source,
          },
          select: { counterpartId: true, id: true },
        });
        if (existing) {
          if (existing.counterpartId == null && counterpartId != null) {
            await db.financialTransaction.update({
              where: { id: existing.id },
              data: { counterpartId },
            });
          }
          duplicateCount++;
          continue;
        }
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
          counterpartId,
          comment: tour.externalReference ? `Ref: ${tour.externalReference}` : undefined,
        },
      });
      createdCount++;
    } catch (error) {
      failedCount++;
      if (errors.length < 10) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        errors.push(message);
      }
    }
  }

  return {
    created: createdCount,
    duplicates: duplicateCount,
    failed: failedCount,
    errors,
    total: unifiedTransactions.length,
  };
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
        counterpart: true,
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
      counterpartId: data.counterpartId,
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
      ...(data.counterpartId !== undefined && { counterpartId: data.counterpartId }),
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

export async function updateTransactionCategory(
  id: number,
  data: {
    color?: null | string;
    name?: string;
    type?: TransactionType;
  },
) {
  return db.transactionCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
}

export async function deleteTransactionCategory(id: number) {
  const usageCount = await db.financialTransaction.count({
    where: { categoryId: id },
  });

  if (usageCount > 0) {
    throw new Error("No se puede eliminar: la categoría está en uso por movimientos financieros.");
  }

  return db.transactionCategory.delete({
    where: { id },
  });
}
