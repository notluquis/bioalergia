import type { TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import {
  fetchMergedTransactions,
  fetchMergedTransactionsBySourceIds,
  type UnifiedTransaction,
} from "./transactions";

const SETTLEMENT_CASHBACK_TYPE = "CASHBACK";
const MP_CARD_CATEGORY_NAME = "Tarjeta Mercadopago";
const MP_CARD_RULE_NAME = "Sistema - Tarjeta Mercadopago por referencia";
const MP_CARD_REFERENCE_PATTERN = "074fe4f0-1808-44bf-92b7-5f6215842ff5-17";

export type CreateFinancialTransactionInput = {
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId?: number | null;
  counterpartId?: number | null;
  comment?: string;
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
          type: rule.type,
        },
        data: {
          categoryId: rule.categoryId,
        },
      }),
    ),
  );
}

async function syncUnifiedTransactions(
  unifiedTransactions: UnifiedTransaction[],
  options?: { applyGlobalRules?: boolean },
) {
  await ensureMercadoPagoCardAutoCategoryRule();

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
  const sourceIds = Array.from(
    new Set(nonCashbackTransactions.map((tx) => tx.sourceId?.trim() ?? "").filter(Boolean)),
  );
  const existingBySourceId =
    sourceIds.length > 0
      ? new Map(
          (
            await db.financialTransaction.findMany({
              where: { sourceId: { in: sourceIds } },
              select: {
                amount: true,
                categoryId: true,
                comment: true,
                counterpartId: true,
                description: true,
                id: true,
                sourceId: true,
                type: true,
              },
            })
          ).map((row) => [row.sourceId ?? "", row]),
        )
      : new Map<
          string,
          {
            amount: Decimal;
            categoryId: null | number;
            comment: null | string;
            counterpartId: null | number;
            description: string;
            id: number;
            sourceId: null | string;
            type: TransactionType;
          }
        >();

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const tour of nonCashbackTransactions) {
    const counterpartId = resolveCounterpartIdForTransaction(
      tour,
      counterpartLookup,
      withdrawLookup,
    );

    try {
      // Check if already synced (idempotent via sourceId)
      if (tour.sourceId) {
        const existing = existingBySourceId.get(tour.sourceId.trim());
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

      const created = await db.financialTransaction.create({
        data: {
          date: tour.transactionDate,
          description: tour.description || "Sin descripcion",
          amount: new Decimal(tour.transactionAmount),
          type,
          sourceId: tour.sourceId ?? undefined,
          categoryId,
          counterpartId,
          comment,
        },
      });
      if (tour.sourceId) {
        existingBySourceId.set(tour.sourceId.trim(), {
          amount: new Decimal(tour.transactionAmount),
          categoryId,
          comment: comment ?? null,
          counterpartId,
          description: tour.description || "Sin descripcion",
          id: created.id,
          sourceId: tour.sourceId,
          type,
        });
      }
      createdCount++;
    } catch (error) {
      failedCount++;
      if (errors.length < 10) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        errors.push(message);
      }
    }
  }

  if (options?.applyGlobalRules !== false) {
    await applyAutoCategoryRulesToExistingTransactions(autoCategoryRules);
  }

  return {
    created: createdCount,
    duplicates: duplicateCount,
    failed: failedCount,
    errors,
    total: nonCashbackTransactions.length,
  };
}

export async function syncFinancialTransactions(_userId: number) {
  // Full sync path used by scheduled/manual global sync flows.
  const unifiedTransactions = await fetchMergedTransactions({
    includeTest: false,
  });
  return syncUnifiedTransactions(unifiedTransactions, { applyGlobalRules: true });
}

export async function syncFinancialTransactionsBySourceIds(sourceIds: string[], _userId: number) {
  const unifiedTransactions = await fetchMergedTransactionsBySourceIds(sourceIds);
  // Incremental path: avoid re-applying all rules across full historical table on each report.
  return syncUnifiedTransactions(unifiedTransactions, { applyGlobalRules: false });
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
        counterpart: {
          include: {
            accounts: {
              select: { accountNumber: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const sourceIds = Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId?.trim())),
    ),
  );

  const [releaseRows, settlementRows] =
    sourceIds.length > 0
      ? await Promise.all([
          db.releaseTransaction.findMany({
            where: { sourceId: { in: sourceIds } },
            select: {
              balanceAmount: true,
              paymentMethod: true,
              payoutBankAccountNumber: true,
              saleDetail: true,
              sourceId: true,
            },
          }),
          db.settlementTransaction.findMany({
            where: { sourceId: { in: sourceIds } },
            select: {
              paymentMethod: true,
              paymentMethodType: true,
              saleDetail: true,
              sourceId: true,
            },
          }),
        ])
      : [[], []];

  const releaseBySourceId = new Map(releaseRows.map((row) => [row.sourceId, row]));
  const settlementBySourceId = new Map(settlementRows.map((row) => [row.sourceId, row]));

  const enrichedTransactions = transactions.map((transaction) => {
    const sourceId = transaction.sourceId ?? null;
    const release = sourceId ? releaseBySourceId.get(sourceId) : undefined;
    const settlement = sourceId ? settlementBySourceId.get(sourceId) : undefined;

    return {
      ...transaction,
      counterpartAccountNumber:
        release?.payoutBankAccountNumber ??
        transaction.counterpart?.accounts?.[0]?.accountNumber ??
        null,
      releaseBalanceAmount: release?.balanceAmount ?? null,
      releasePaymentMethod: release?.paymentMethod ?? null,
      releaseSaleDetail: release?.saleDetail ?? null,
      settlementPaymentMethod: settlement?.paymentMethod ?? null,
      settlementPaymentMethodType: settlement?.paymentMethodType ?? null,
      settlementSaleDetail: settlement?.saleDetail ?? null,
    };
  });

  return {
    data: enrichedTransactions,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function listAvailableFinancialTransactionMonths() {
  const rows = await db.$queryRaw<Array<{ month: string }>>`
    SELECT to_char(date_trunc('month', ft."date"), 'YYYY-MM') AS month
    FROM financial_transactions ft
    LEFT JOIN settlement_transactions st
      ON st.source_id = ft.source_id
    WHERE st.transaction_type IS DISTINCT FROM ${SETTLEMENT_CASHBACK_TYPE}
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  return rows.map((row) => row.month).filter(Boolean);
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

const normalizeCategoryName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

async function mergeDuplicateTransactionCategoriesByName() {
  const categories = await db.transactionCategory.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  const groups = new Map<string, { id: number; name: string }[]>();
  for (const category of categories) {
    const key = normalizeCategoryName(category.name);
    if (!key) continue;
    const current = groups.get(key);
    if (current) {
      current.push(category);
    } else {
      groups.set(key, [category]);
    }
  }

  const duplicateSets = Array.from(groups.values()).filter((group) => group.length > 1);
  if (duplicateSets.length === 0) {
    return;
  }

  await db.$transaction(async (tx) => {
    for (const group of duplicateSets) {
      const [primary, ...duplicates] = group;
      if (!primary || duplicates.length === 0) continue;
      const duplicateIds = duplicates.map((item) => item.id);

      await tx.financialTransaction.updateMany({
        where: { categoryId: { in: duplicateIds } },
        data: { categoryId: primary.id },
      });

      await tx.financialAutoCategoryRule.updateMany({
        where: { categoryId: { in: duplicateIds } },
        data: { categoryId: primary.id },
      });

      await tx.transactionCategory.deleteMany({
        where: { id: { in: duplicateIds } },
      });
    }
  });
}

async function findCategoryByNormalizedName(name: string, excludeId?: number) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) {
    return null;
  }

  const categories = await db.transactionCategory.findMany({
    select: { id: true, name: true },
  });

  return (
    categories.find((category) => {
      if (excludeId != null && category.id === excludeId) {
        return false;
      }
      return normalizeCategoryName(category.name) === normalized;
    }) ?? null
  );
}

export async function listTransactionCategories() {
  await mergeDuplicateTransactionCategoriesByName();
  return db.transactionCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createTransactionCategory(data: {
  name: string;
  type: TransactionType;
  color?: string;
}) {
  await mergeDuplicateTransactionCategoriesByName();

  const cleanName = data.name.trim().replace(/\s+/g, " ");
  if (!cleanName) {
    throw new Error("El nombre de la categoría es obligatorio");
  }

  const duplicate = await findCategoryByNormalizedName(cleanName);
  if (duplicate) {
    throw new Error("Ya existe una categoría con ese nombre");
  }

  return db.transactionCategory.create({
    data: {
      ...data,
      name: cleanName,
    },
  });
}

export async function updateTransactionCategory(
  id: number,
  data: {
    color?: null | string;
    name?: string;
    type?: TransactionType;
  },
) {
  await mergeDuplicateTransactionCategoriesByName();

  if (data.name !== undefined) {
    const cleanName = data.name.trim().replace(/\s+/g, " ");
    if (!cleanName) {
      throw new Error("El nombre de la categoría es obligatorio");
    }

    const duplicate = await findCategoryByNormalizedName(cleanName, id);
    if (duplicate) {
      throw new Error("Ya existe una categoría con ese nombre");
    }

    data.name = cleanName;
  }

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
      type: rule.type,
    },
    data: {
      categoryId: rule.categoryId,
    },
  });
}

async function ensureMercadoPagoCardAutoCategoryRule() {
  const category =
    (await db.transactionCategory.findFirst({
      where: {
        name: MP_CARD_CATEGORY_NAME,
        type: "EXPENSE",
      },
      select: { id: true },
    })) ??
    (await db.transactionCategory.create({
      data: {
        color: "#3B82F6",
        name: MP_CARD_CATEGORY_NAME,
        type: "EXPENSE",
      },
      select: { id: true },
    }));

  const existingRule = await db.financialAutoCategoryRule.findFirst({
    where: { name: MP_CARD_RULE_NAME },
    select: { id: true },
  });

  const ensuredRule = existingRule
    ? await db.financialAutoCategoryRule.update({
        where: { id: existingRule.id },
        data: {
          categoryId: category.id,
          commentContains: MP_CARD_REFERENCE_PATTERN,
          counterpartId: null,
          descriptionContains: null,
          isActive: true,
          maxAmount: null,
          minAmount: null,
          priority: 10000,
          type: "EXPENSE",
        },
        select: { id: true },
      })
    : await db.financialAutoCategoryRule.create({
        data: {
          categoryId: category.id,
          commentContains: MP_CARD_REFERENCE_PATTERN,
          counterpartId: null,
          descriptionContains: null,
          isActive: true,
          maxAmount: null,
          minAmount: null,
          name: MP_CARD_RULE_NAME,
          priority: 10000,
          type: "EXPENSE",
        },
        select: { id: true },
      });

  // Apply to historical records too, including already classified ones.
  await applySingleAutoCategoryRule(ensuredRule.id);
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
