import type { TransactionSource, TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import { fetchMergedTransactions } from "./transactions";

const SETTLEMENT_CASHBACK_TYPE = "CASHBACK";

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
const NON_ACCOUNT_CHARS_REGEX = /[^0-9a-z]/gi;
const LEADING_ZEROS_REGEX = /^0+/;

const normalizeRut = (value: null | string | undefined) => {
  if (!value) return "";
  return value.replace(NON_RUT_CHARS_REGEX, "").toUpperCase();
};

const normalizeAccount = (value: null | string | undefined) => {
  if (!value) return "";
  const compact = value.replace(NON_ACCOUNT_CHARS_REGEX, "").toUpperCase();
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
  const nonCashbackTransactions = unifiedTransactions.filter(
    (tour) =>
      !(
        tour.source === "settlement" &&
        tour.transactionType?.toUpperCase() === SETTLEMENT_CASHBACK_TYPE
      ),
  );
  const counterpartLookup = await buildCounterpartLookup();

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const tour of nonCashbackTransactions) {
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
    total: nonCashbackTransactions.length,
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

  type FinancialTransactionWhereInput = NonNullable<
    Parameters<typeof db.financialTransaction.findMany>[0]
  >["where"];
  const where: FinancialTransactionWhereInput = {};

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

  const cashbackSettlementSourceIds = (
    await db.settlementTransaction.findMany({
      where: {
        sourceId: { not: "" },
        transactionType: SETTLEMENT_CASHBACK_TYPE,
      },
      select: { sourceId: true },
    })
  ).map((row) => row.sourceId);

  if (cashbackSettlementSourceIds.length > 0) {
    where.NOT = [
      {
        source: "MERCADOPAGO",
        sourceId: { in: cashbackSettlementSourceIds },
      },
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

export async function getFinancialSummaryByCategory(params: { from?: Date; to?: Date }) {
  type FinancialTransactionWhereInput = NonNullable<
    Parameters<typeof db.financialTransaction.findMany>[0]
  >["where"];
  const where: FinancialTransactionWhereInput = {};

  if (params.from || params.to) {
    where.date = {};
    if (params.from) where.date.gte = params.from;
    if (params.to) where.date.lte = params.to;
  }

  const cashbackSettlementSourceIds = (
    await db.settlementTransaction.findMany({
      where: {
        sourceId: { not: "" },
        transactionType: SETTLEMENT_CASHBACK_TYPE,
      },
      select: { sourceId: true },
    })
  ).map((row) => row.sourceId);

  if (cashbackSettlementSourceIds.length > 0) {
    where.NOT = [
      {
        source: "MERCADOPAGO",
        sourceId: { in: cashbackSettlementSourceIds },
      },
    ];
  }

  const grouped = await db.financialTransaction.groupBy({
    by: ["categoryId", "type"],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  });

  const categoryIds = Array.from(
    new Set(grouped.map((row) => row.categoryId).filter((id): id is number => id != null)),
  );

  const categories =
    categoryIds.length > 0
      ? await db.transactionCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { color: true, id: true, name: true },
        })
      : [];

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  let totalIncome = 0;
  let totalExpense = 0;
  let totalCount = 0;

  const byCategory = grouped
    .map((row) => {
      const rawAmount = Number(row._sum.amount ?? 0);
      const total = row.type === "EXPENSE" ? Math.abs(rawAmount) : rawAmount;
      const category = row.categoryId != null ? categoryById.get(row.categoryId) : undefined;
      const count = row._count._all;

      if (row.type === "INCOME") {
        totalIncome += total;
      } else {
        totalExpense += total;
      }
      totalCount += count;

      return {
        categoryColor: category?.color ?? null,
        categoryId: row.categoryId,
        categoryName: category?.name ?? "Sin categoría",
        count,
        total,
        type: row.type,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    byCategory,
    totals: {
      count: totalCount,
      expense: totalExpense,
      income: totalIncome,
      net: totalIncome - totalExpense,
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
