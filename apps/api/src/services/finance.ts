import type { TransactionSource, TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import { fetchMergedTransactions } from "./transactions";

const SETTLEMENT_CASHBACK_TYPE = "CASHBACK";
const AUTO_RULE_SOURCE: TransactionSource = "MERCADOPAGO";

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

type WithdrawLookup = {
  byWithdrawId: Map<
    string,
    {
      bankAccountNumber: null | string;
      identificationNumber: null | string;
    }
  >;
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

async function buildWithdrawLookup(): Promise<WithdrawLookup> {
  const withdrawals = await db.withdrawTransaction.findMany({
    select: {
      bankAccountNumber: true,
      identificationNumber: true,
      withdrawId: true,
    },
  });

  const byWithdrawId = new Map<
    string,
    {
      bankAccountNumber: null | string;
      identificationNumber: null | string;
    }
  >();

  for (const withdrawal of withdrawals) {
    const key = withdrawal.withdrawId?.trim();
    if (!key || byWithdrawId.has(key)) continue;
    byWithdrawId.set(key, {
      bankAccountNumber: withdrawal.bankAccountNumber ?? null,
      identificationNumber: withdrawal.identificationNumber ?? null,
    });
  }

  return { byWithdrawId };
}

type UnifiedTransaction = Awaited<ReturnType<typeof fetchMergedTransactions>>[number];

function resolveCounterpartIdForTransaction(
  tour: UnifiedTransaction,
  counterpartLookup: CounterpartLookup,
  withdrawLookup: WithdrawLookup,
) {
  // Release flow:
  // 1) source_id (release) -> withdraw_id (withdraw) to recover RUT/account.
  // 2) fallback by payout_bank_account_number against counterpart_accounts.
  if (tour.source === "release") {
    const linkedWithdraw = tour.sourceId
      ? withdrawLookup.byWithdrawId.get(tour.sourceId.trim())
      : undefined;

    const rutFromWithdraw = normalizeRut(linkedWithdraw?.identificationNumber);
    const rutFromRelease = normalizeRut(tour.identificationNumber);
    const counterpartIdByRut = counterpartLookup.byRut.get(rutFromWithdraw || rutFromRelease);
    if (counterpartIdByRut != null) {
      return counterpartIdByRut;
    }

    const accountFromRelease = normalizeAccount(tour.bankAccountNumber);
    const accountFromWithdraw = normalizeAccount(linkedWithdraw?.bankAccountNumber);
    const counterpartIdByAccount = counterpartLookup.byAccount.get(
      accountFromRelease || accountFromWithdraw,
    );
    return counterpartIdByAccount ?? null;
  }

  const counterpartIdByRut = counterpartLookup.byRut.get(normalizeRut(tour.identificationNumber));
  const counterpartIdByAccount = counterpartLookup.byAccount.get(
    normalizeAccount(tour.bankAccountNumber),
  );
  return counterpartIdByRut ?? counterpartIdByAccount ?? null;
}

type AutoCategoryRule = {
  categoryId: number;
  commentContains: null | string;
  counterpartId: null | number;
  descriptionContains: null | string;
  maxAmount: null | number;
  minAmount: null | number;
  priority: number;
  type: TransactionType;
};

type AutoCategoryRuleLookup = {
  rules: AutoCategoryRule[];
};

const normalizeRuleText = (value: null | string | undefined) => (value ?? "").toLowerCase().trim();

async function buildAutoCategoryRuleLookup(): Promise<AutoCategoryRuleLookup> {
  const rules = await db.financialAutoCategoryRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
    select: {
      categoryId: true,
      commentContains: true,
      counterpartId: true,
      descriptionContains: true,
      maxAmount: true,
      minAmount: true,
      priority: true,
      type: true,
    },
  });

  return {
    rules: rules.map((rule) => ({
      categoryId: rule.categoryId,
      commentContains: rule.commentContains ?? null,
      counterpartId: rule.counterpartId ?? null,
      descriptionContains: rule.descriptionContains ?? null,
      maxAmount: rule.maxAmount != null ? Number(rule.maxAmount) : null,
      minAmount: rule.minAmount != null ? Number(rule.minAmount) : null,
      priority: rule.priority,
      type: rule.type,
    })),
  };
}

function resolveAutoCategoryId(
  type: TransactionType,
  amount: number,
  comment: null | string | undefined,
  counterpartId: null | number,
  description: null | string | undefined,
  rules: AutoCategoryRuleLookup,
) {
  const normalizedComment = normalizeRuleText(comment);
  const normalizedDescription = normalizeRuleText(description);

  for (const rule of rules.rules) {
    if (rule.type !== type) {
      continue;
    }
    if (rule.counterpartId != null && counterpartId !== rule.counterpartId) {
      continue;
    }
    if (rule.minAmount != null && amount < rule.minAmount) {
      continue;
    }
    if (rule.maxAmount != null && amount > rule.maxAmount) {
      continue;
    }
    if (
      rule.commentContains != null &&
      !normalizedComment.includes(normalizeRuleText(rule.commentContains))
    ) {
      continue;
    }
    if (
      rule.descriptionContains != null &&
      !normalizedDescription.includes(normalizeRuleText(rule.descriptionContains))
    ) {
      continue;
    }
    return rule.categoryId;
  }

  return null;
}

async function applyAutoCategoryRulesToExistingTransactions(rules: AutoCategoryRuleLookup) {
  if (rules.rules.length === 0) {
    return;
  }

  await db.$transaction(
    rules.rules.map((rule) =>
      db.financialTransaction.updateMany({
        where: {
          categoryId: { not: rule.categoryId },
          ...(rule.counterpartId != null && { counterpartId: rule.counterpartId }),
          ...(rule.minAmount != null && {
            amount: { gte: Number(rule.minAmount) },
          }),
          ...(rule.maxAmount != null && {
            amount: {
              ...(rule.minAmount != null ? { gte: Number(rule.minAmount) } : {}),
              lte: Number(rule.maxAmount),
            },
          }),
          ...(rule.commentContains != null && {
            comment: { contains: rule.commentContains, mode: "insensitive" },
          }),
          ...(rule.descriptionContains != null && {
            description: { contains: rule.descriptionContains, mode: "insensitive" },
          }),
          source: AUTO_RULE_SOURCE,
          type: rule.type,
        },
        data: {
          categoryId: rule.categoryId,
        },
      }),
    ),
  );
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
  const withdrawLookup = await buildWithdrawLookup();
  const autoCategoryRules = await buildAutoCategoryRuleLookup();

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const tour of nonCashbackTransactions) {
    // All MP-sourced transactions map to MERCADOPAGO source
    const source: TransactionSource = "MERCADOPAGO";
    const counterpartId = resolveCounterpartIdForTransaction(
      tour,
      counterpartLookup,
      withdrawLookup,
    );

    try {
      // Check if already synced (idempotent via sourceId)
      if (tour.sourceId) {
        const existing = await db.financialTransaction.findFirst({
          where: { source, sourceId: tour.sourceId },
          select: {
            amount: true,
            categoryId: true,
            comment: true,
            counterpartId: true,
            description: true,
            id: true,
            type: true,
          },
        });
        if (existing) {
          const nextCounterpartId = counterpartId ?? existing.counterpartId ?? null;
          const nextCategoryId = resolveAutoCategoryId(
            existing.type,
            Number(existing.amount),
            existing.comment,
            nextCounterpartId,
            existing.description,
            autoCategoryRules,
          );
          const updateData: {
            categoryId?: null | number;
            counterpartId?: null | number;
          } = {};

          if (counterpartId != null && existing.counterpartId !== counterpartId) {
            updateData.counterpartId = counterpartId;
          }
          if (nextCategoryId != null && existing.categoryId !== nextCategoryId) {
            updateData.categoryId = nextCategoryId;
          }

          if (updateData.counterpartId !== undefined || updateData.categoryId !== undefined) {
            await db.financialTransaction.update({
              where: { id: existing.id },
              data: updateData,
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
          select: {
            amount: true,
            categoryId: true,
            comment: true,
            counterpartId: true,
            description: true,
            id: true,
            type: true,
          },
        });
        if (existing) {
          const nextCounterpartId = counterpartId ?? existing.counterpartId ?? null;
          const nextCategoryId = resolveAutoCategoryId(
            existing.type,
            Number(existing.amount),
            existing.comment,
            nextCounterpartId,
            existing.description,
            autoCategoryRules,
          );
          const updateData: {
            categoryId?: null | number;
            counterpartId?: null | number;
          } = {};

          if (counterpartId != null && existing.counterpartId !== counterpartId) {
            updateData.counterpartId = counterpartId;
          }
          if (nextCategoryId != null && existing.categoryId !== nextCategoryId) {
            updateData.categoryId = nextCategoryId;
          }

          if (updateData.counterpartId !== undefined || updateData.categoryId !== undefined) {
            await db.financialTransaction.update({
              where: { id: existing.id },
              data: updateData,
            });
          }
          duplicateCount++;
          continue;
        }
      }

      const type: TransactionType = tour.transactionAmount >= 0 ? "INCOME" : "EXPENSE";
      const comment = tour.externalReference ? `Ref: ${tour.externalReference}` : undefined;
      const categoryId = resolveAutoCategoryId(
        type,
        tour.transactionAmount,
        comment,
        counterpartId,
        tour.description,
        autoCategoryRules,
      );

      await db.financialTransaction.create({
        data: {
          date: tour.transactionDate,
          description: tour.description || "Sin descripcion",
          amount: new Decimal(tour.transactionAmount),
          type,
          source,
          sourceId: tour.sourceId ?? undefined,
          categoryId,
          counterpartId,
          comment,
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

  await applyAutoCategoryRulesToExistingTransactions(autoCategoryRules);

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
      source: data.source ?? "MERCADOPAGO",
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

type FinancialAutoCategoryRuleInput = {
  categoryId: number;
  commentContains?: null | string;
  counterpartId?: null | number;
  descriptionContains?: null | string;
  isActive?: boolean;
  maxAmount?: null | number;
  minAmount?: null | number;
  name: string;
  priority?: number;
  type: TransactionType;
};

async function ensureCategoryMatchesRuleType(categoryId: number, type: TransactionType) {
  const category = await db.transactionCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!category) {
    throw new Error("Categoría no encontrada");
  }
  if (category.type !== type) {
    throw new Error("El tipo de la categoría no coincide con el tipo de la regla");
  }
}

async function applySingleAutoCategoryRule(ruleId: number) {
  const rule = await db.financialAutoCategoryRule.findUnique({
    where: { id: ruleId },
    select: {
      categoryId: true,
      commentContains: true,
      counterpartId: true,
      descriptionContains: true,
      isActive: true,
      maxAmount: true,
      minAmount: true,
      type: true,
    },
  });

  if (!rule || !rule.isActive) {
    return;
  }

  await db.financialTransaction.updateMany({
    where: {
      categoryId: { not: rule.categoryId },
      ...(rule.counterpartId != null && { counterpartId: rule.counterpartId }),
      ...(rule.minAmount != null && {
        amount: { gte: Number(rule.minAmount) },
      }),
      ...(rule.maxAmount != null && {
        amount: {
          ...(rule.minAmount != null ? { gte: Number(rule.minAmount) } : {}),
          lte: Number(rule.maxAmount),
        },
      }),
      ...(rule.commentContains != null && {
        comment: { contains: rule.commentContains, mode: "insensitive" },
      }),
      ...(rule.descriptionContains != null && {
        description: { contains: rule.descriptionContains, mode: "insensitive" },
      }),
      source: AUTO_RULE_SOURCE,
      type: rule.type,
    },
    data: {
      categoryId: rule.categoryId,
    },
  });
}

export async function listFinancialAutoCategoryRules() {
  return db.financialAutoCategoryRule.findMany({
    include: {
      category: true,
      counterpart: true,
    },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
}

export async function createFinancialAutoCategoryRule(data: FinancialAutoCategoryRuleInput) {
  await ensureCategoryMatchesRuleType(data.categoryId, data.type);

  const created = await db.financialAutoCategoryRule.create({
    data: {
      categoryId: data.categoryId,
      commentContains: data.commentContains ?? null,
      counterpartId: data.counterpartId ?? null,
      descriptionContains: data.descriptionContains ?? null,
      isActive: data.isActive ?? true,
      maxAmount: data.maxAmount != null ? new Decimal(data.maxAmount) : null,
      minAmount: data.minAmount != null ? new Decimal(data.minAmount) : null,
      name: data.name,
      priority: data.priority ?? 0,
      type: data.type,
    },
    include: {
      category: true,
      counterpart: true,
    },
  });

  await applySingleAutoCategoryRule(created.id);
  return created;
}

export async function updateFinancialAutoCategoryRule(
  id: number,
  data: Partial<FinancialAutoCategoryRuleInput>,
) {
  const existing = await db.financialAutoCategoryRule.findUnique({
    where: { id },
    select: {
      categoryId: true,
      commentContains: true,
      counterpartId: true,
      descriptionContains: true,
      id: true,
      isActive: true,
      maxAmount: true,
      minAmount: true,
      name: true,
      priority: true,
      type: true,
    },
  });
  if (!existing) {
    throw new Error("Regla no encontrada");
  }

  const nextType = data.type ?? existing.type;
  const nextCategoryId = data.categoryId ?? existing.categoryId;
  await ensureCategoryMatchesRuleType(nextCategoryId, nextType);

  const updated = await db.financialAutoCategoryRule.update({
    where: { id },
    data: {
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.counterpartId !== undefined && { counterpartId: data.counterpartId }),
      ...(data.commentContains !== undefined && { commentContains: data.commentContains }),
      ...(data.descriptionContains !== undefined && {
        descriptionContains: data.descriptionContains,
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.maxAmount !== undefined && {
        maxAmount: data.maxAmount != null ? new Decimal(data.maxAmount) : null,
      }),
      ...(data.minAmount !== undefined && {
        minAmount: data.minAmount != null ? new Decimal(data.minAmount) : null,
      }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.type !== undefined && { type: data.type }),
    },
    include: {
      category: true,
      counterpart: true,
    },
  });

  await applySingleAutoCategoryRule(updated.id);
  return updated;
}

export async function deleteFinancialAutoCategoryRule(id: number) {
  return db.financialAutoCategoryRule.delete({
    where: { id },
  });
}
