import type { TransactionType } from "@finanzas/db";
import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import { AppError } from "../lib/app-error";
import {
  fetchMergedTransactions,
  fetchMergedTransactionsBySourceIds,
  type UnifiedTransaction,
} from "./transactions";

const SETTLEMENT_CASHBACK_TYPE = "CASHBACK";
const MP_CARD_CATEGORY_NAME = "Tarjeta Mercadopago";
const MP_CARD_RULE_NAME = "Sistema - Tarjeta Mercadopago por referencia";
const MP_CARD_REFERENCE_PATTERN = "74fe4f0-1808-44bf-92b7-5f6215842ff5-17";
const PERSONAL_DR_CATEGORY_NAME = "Personal Dr";
const PERSONAL_DR_RULE_NAME_PREFIX = "Sistema - Personal Dr por referencia";
const PATIENTS_CATEGORY_NAME = "Pacientes";
const PATIENTS_RULE_NAME = "Sistema - Pacientes por keyword";
const PATIENTS_KEYWORD = "paciente";
const NON_ACCOUNTABLE_CATEGORY_ICON = "NON_ACCOUNTABLE";
const PERSONAL_DR_REFERENCE_PATTERNS = [
  "db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
  "e3c65f7a-64c4-4664-b3ed-87674105d34f-17",
];
const PERSONAL_DR_REFERENCE_REGEX =
  /^ref:\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-17\d*$/i;
const PERSONAL_DR_REFERENCE_SQL_REGEX =
  "^\\s*ref:\\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-17[0-9]*\\s*$";
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

async function getNonAccountableCategoryIds() {
  const categories = await db.transactionCategory.findMany({
    where: { icon: NON_ACCOUNTABLE_CATEGORY_ICON },
    select: { id: true },
  });
  return categories.map((category) => category.id);
}

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
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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

function assertPeriodOrThrow(period: string) {
  if (!PERIOD_REGEX.test(period)) {
    throw new AppError(422, {
      code: "INVALID_PERIOD",
      message: "Periodo inválido. Usa formato YYYY-MM.",
    });
  }
}

function getPeriodRange(period: string) {
  assertPeriodOrThrow(period);
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

const toPeriod = (value: Date) => value.toISOString().slice(0, 7);

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

function matchesPersonalDrPattern(comment: null | string | undefined) {
  if (!comment) return false;
  return PERSONAL_DR_REFERENCE_REGEX.test(comment.trim());
}

const normalizeSearchText = (value: null | string | undefined) =>
  (value ?? "").toLowerCase().normalize("NFD").replace(DIACRITICS_REGEX, "").trim();

const mergeDescriptionWithSaleDetails = (
  description: null | string | undefined,
  saleDetails: string[],
) => {
  const base = (description ?? "").trim();
  const details = saleDetails
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
  const merged = `${base} ${details}`.trim();
  return merged.length > 0 ? merged : null;
};

function matchesPatientsPattern(values: Array<null | string | undefined>, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return false;
  return values.some((value) => normalizeSearchText(value).includes(normalizedKeyword));
}

async function applyPersonalDrPatternCategoryToExistingTransactions(
  categoryId: number,
  options?: { onlyUncategorized?: boolean },
) {
  if (options?.onlyUncategorized) {
    const updatedRows = await db.$executeRaw`
      UPDATE financial_transactions
      SET category_id = ${categoryId},
          updated_at = NOW()
      WHERE type = 'EXPENSE'
        AND category_id IS NULL
        AND comment IS NOT NULL
        AND comment ~* ${PERSONAL_DR_REFERENCE_SQL_REGEX}
    `;
    return Number(updatedRows);
  }

  const updatedRows = await db.$executeRaw`
    UPDATE financial_transactions
    SET category_id = ${categoryId},
        updated_at = NOW()
    WHERE type = 'EXPENSE'
      AND comment IS NOT NULL
      AND comment ~* ${PERSONAL_DR_REFERENCE_SQL_REGEX}
      AND category_id IS DISTINCT FROM ${categoryId}
  `;
  return Number(updatedRows);
}

async function applyPatientsPatternCategoryToExistingTransactions(
  categoryId: number,
  keyword: string,
  options?: { onlyUncategorized?: boolean },
) {
  const normalizedKeyword = normalizeSearchText(keyword) || PATIENTS_KEYWORD;
  const likePattern = `%${normalizedKeyword}%`;

  if (options?.onlyUncategorized) {
    const updatedRows = await db.$executeRaw`
      UPDATE financial_transactions ft
      SET category_id = ${categoryId},
          updated_at = NOW()
      WHERE ft.type = 'INCOME'
        AND ft.category_id IS NULL
        AND (
          ft.description ILIKE ${likePattern}
          OR (ft.comment IS NOT NULL AND ft.comment ILIKE ${likePattern})
          OR EXISTS (
            SELECT 1
            FROM release_transactions rt
            WHERE rt.source_id = ft.source_id
              AND rt.sale_detail IS NOT NULL
              AND rt.sale_detail ILIKE ${likePattern}
          )
          OR EXISTS (
            SELECT 1
            FROM settlement_transactions st
            WHERE st.source_id = ft.source_id
              AND st.sale_detail IS NOT NULL
              AND st.sale_detail ILIKE ${likePattern}
          )
        )
    `;
    return Number(updatedRows);
  }

  const updatedRows = await db.$executeRaw`
    UPDATE financial_transactions ft
    SET category_id = ${categoryId},
        updated_at = NOW()
    WHERE ft.type = 'INCOME'
      AND ft.category_id IS DISTINCT FROM ${categoryId}
      AND (
        ft.description ILIKE ${likePattern}
        OR (ft.comment IS NOT NULL AND ft.comment ILIKE ${likePattern})
        OR EXISTS (
          SELECT 1
          FROM release_transactions rt
          WHERE rt.source_id = ft.source_id
            AND rt.sale_detail IS NOT NULL
            AND rt.sale_detail ILIKE ${likePattern}
        )
        OR EXISTS (
          SELECT 1
          FROM settlement_transactions st
          WHERE st.source_id = ft.source_id
            AND st.sale_detail IS NOT NULL
            AND st.sale_detail ILIKE ${likePattern}
        )
      )
  `;
  return Number(updatedRows);
}

async function applyAutoCategoryRulesToExistingTransactions(
  rules: AutoCategoryRuleLookup,
  options?: { onlyUncategorized?: boolean },
) {
  if (rules.rules.length === 0) {
    return 0;
  }

  const result = await db.$transaction(
    rules.rules.map((rule) =>
      db.financialTransaction.updateMany({
        where: {
          ...(options?.onlyUncategorized
            ? { categoryId: null }
            : { categoryId: { not: rule.categoryId } }),
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

  return result.reduce((acc, item) => acc + item.count, 0);
}

async function ensurePatientsAutoCategoryRule() {
  const category =
    (await db.transactionCategory.findFirst({
      where: {
        name: PATIENTS_CATEGORY_NAME,
        type: "INCOME",
      },
      select: { id: true },
    })) ??
    (await db.transactionCategory.create({
      data: {
        color: "#22C55E",
        name: PATIENTS_CATEGORY_NAME,
        type: "INCOME",
      },
      select: { id: true },
    }));

  const existingRule = await db.financialAutoCategoryRule.findFirst({
    where: { name: PATIENTS_RULE_NAME },
    select: { id: true },
  });

  const ensuredRule = existingRule
    ? await db.financialAutoCategoryRule.update({
        where: { id: existingRule.id },
        data: {
          categoryId: category.id,
          commentContains: null,
          counterpartId: null,
          descriptionContains: PATIENTS_KEYWORD,
          isActive: true,
          maxAmount: null,
          minAmount: null,
          priority: 10500,
          type: "INCOME",
        },
        select: {
          commentContains: true,
          descriptionContains: true,
          id: true,
        },
      })
    : await db.financialAutoCategoryRule.create({
        data: {
          categoryId: category.id,
          commentContains: null,
          counterpartId: null,
          descriptionContains: PATIENTS_KEYWORD,
          isActive: true,
          maxAmount: null,
          minAmount: null,
          name: PATIENTS_RULE_NAME,
          priority: 10500,
          type: "INCOME",
        },
        select: {
          commentContains: true,
          descriptionContains: true,
          id: true,
        },
      });

  // Applies the DB rule to historical records based on financial_transaction fields.
  await applySingleAutoCategoryRule(ensuredRule.id);

  const keyword =
    ensuredRule.descriptionContains ?? ensuredRule.commentContains ?? PATIENTS_KEYWORD;

  return {
    categoryId: category.id,
    keyword,
  };
}

async function syncUnifiedTransactions(
  unifiedTransactions: UnifiedTransaction[],
  options?: { applyGlobalRules?: boolean },
) {
  await ensureMercadoPagoCardAutoCategoryRule();
  const personalDrCategoryId = await ensurePersonalDrAutoCategoryRules();
  const patientsRule = await ensurePatientsAutoCategoryRule();

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
  const [releaseSaleDetails, settlementSaleDetails] =
    sourceIds.length > 0
      ? await Promise.all([
          db.releaseTransaction.findMany({
            where: { sourceId: { in: sourceIds } },
            select: {
              saleDetail: true,
              sourceId: true,
            },
          }),
          db.settlementTransaction.findMany({
            where: { sourceId: { in: sourceIds } },
            select: {
              saleDetail: true,
              sourceId: true,
            },
          }),
        ])
      : [[], []];
  const saleDetailsBySourceId = new Map<string, string[]>();
  for (const row of [...releaseSaleDetails, ...settlementSaleDetails]) {
    const sourceId = row.sourceId.trim();
    if (!sourceId || !row.saleDetail?.trim()) continue;
    const bucket = saleDetailsBySourceId.get(sourceId) ?? [];
    bucket.push(row.saleDetail);
    saleDetailsBySourceId.set(sourceId, bucket);
  }
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
          const sourceSaleDetails = existing.sourceId
            ? (saleDetailsBySourceId.get(existing.sourceId.trim()) ?? [])
            : [];
          const nextCategoryId = resolveAutoCategoryId(
            existing.type,
            Number(existing.amount),
            existing.comment,
            nextCounterpartId,
            mergeDescriptionWithSaleDetails(existing.description, sourceSaleDetails),
            autoCategoryRules,
          );
          const matchesPatients =
            existing.type === "INCOME" &&
            matchesPatientsPattern(
              [existing.description, existing.comment, ...sourceSaleDetails],
              patientsRule.keyword,
            );
          const nextSystemCategoryId =
            existing.type === "EXPENSE" && matchesPersonalDrPattern(existing.comment)
              ? personalDrCategoryId
              : matchesPatients
                ? patientsRule.categoryId
                : null;
          const updateData: {
            categoryId?: null | number;
            counterpartId?: null | number;
          } = {};

          if (counterpartId != null && existing.counterpartId !== counterpartId) {
            updateData.counterpartId = counterpartId;
          }
          if (nextSystemCategoryId != null && existing.categoryId !== nextSystemCategoryId) {
            updateData.categoryId = nextSystemCategoryId;
          } else if (nextCategoryId != null && existing.categoryId !== nextCategoryId) {
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
          const matchesPatients =
            existing.type === "INCOME" &&
            matchesPatientsPattern([existing.description, existing.comment], patientsRule.keyword);
          const nextSystemCategoryId =
            existing.type === "EXPENSE" && matchesPersonalDrPattern(existing.comment)
              ? personalDrCategoryId
              : matchesPatients
                ? patientsRule.categoryId
                : null;
          const updateData: {
            categoryId?: null | number;
            counterpartId?: null | number;
          } = {};

          if (counterpartId != null && existing.counterpartId !== counterpartId) {
            updateData.counterpartId = counterpartId;
          }
          if (nextSystemCategoryId != null && existing.categoryId !== nextSystemCategoryId) {
            updateData.categoryId = nextSystemCategoryId;
          } else if (nextCategoryId != null && existing.categoryId !== nextCategoryId) {
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
      const sourceSaleDetails = tour.sourceId
        ? (saleDetailsBySourceId.get(tour.sourceId.trim()) ?? [])
        : [];
      const categoryId = resolveAutoCategoryId(
        type,
        tour.transactionAmount,
        comment,
        counterpartId,
        mergeDescriptionWithSaleDetails(tour.description, sourceSaleDetails),
        autoCategoryRules,
      );
      const isPatientsIncome =
        type === "INCOME" &&
        matchesPatientsPattern(
          [tour.description, comment, ...sourceSaleDetails],
          patientsRule.keyword,
        );
      const resolvedCategoryId =
        type === "EXPENSE" && matchesPersonalDrPattern(comment)
          ? personalDrCategoryId
          : isPatientsIncome
            ? patientsRule.categoryId
            : categoryId;

      const created = await db.financialTransaction.create({
        data: {
          date: tour.transactionDate,
          description: tour.description || "Sin descripcion",
          amount: new Decimal(tour.transactionAmount),
          type,
          sourceId: tour.sourceId ?? undefined,
          categoryId: resolvedCategoryId,
          counterpartId,
          comment,
        },
      });
      if (tour.sourceId) {
        existingBySourceId.set(tour.sourceId.trim(), {
          amount: new Decimal(tour.transactionAmount),
          categoryId: resolvedCategoryId,
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
    await applyPersonalDrPatternCategoryToExistingTransactions(personalDrCategoryId);
    await applyPatientsPatternCategoryToExistingTransactions(
      patientsRule.categoryId,
      patientsRule.keyword,
    );
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

export async function syncUncategorizedTransactionsByPatterns() {
  await ensureMercadoPagoCardAutoCategoryRule();
  const personalDrCategoryId = await ensurePersonalDrAutoCategoryRules();
  const patientsRule = await ensurePatientsAutoCategoryRule();
  const autoCategoryRules = await buildAutoCategoryRuleLookup();
  const updatedByRules = await applyAutoCategoryRulesToExistingTransactions(autoCategoryRules, {
    onlyUncategorized: true,
  });
  const updatedByPersonalPattern = await applyPersonalDrPatternCategoryToExistingTransactions(
    personalDrCategoryId,
    {
      onlyUncategorized: true,
    },
  );
  const updatedByPatientsPattern = await applyPatientsPatternCategoryToExistingTransactions(
    patientsRule.categoryId,
    patientsRule.keyword,
    {
      onlyUncategorized: true,
    },
  );
  return {
    updated: updatedByRules + updatedByPersonalPattern + updatedByPatientsPattern,
  };
}

export async function listFinancialTransactions(params: {
  from?: Date;
  to?: Date;
  effectivePeriod?: string;
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

  if (params.effectivePeriod) {
    const { from, to } = getPeriodRange(params.effectivePeriod);
    const [periodAllocations, periodTransactionsWithoutAllocations] = await Promise.all([
      db.$queryRaw<Array<{ transactionId: number }>>`
        SELECT DISTINCT transaction_id AS "transactionId"
        FROM financial_transaction_allocations
        WHERE period = ${params.effectivePeriod}
      `,
      db.$queryRaw<Array<{ id: number }>>`
        SELECT ft.id
        FROM financial_transactions ft
        WHERE ft.date >= ${from}
          AND ft.date <= ${to}
          AND NOT EXISTS (
            SELECT 1
            FROM financial_transaction_allocations fta
            WHERE fta.transaction_id = ft.id
          )
      `,
    ]);

    const effectiveTransactionIds = Array.from(
      new Set([
        ...periodAllocations.map((row) => row.transactionId),
        ...periodTransactionsWithoutAllocations.map((row) => row.id),
      ]),
    );

    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...existingAnd,
      {
        id: { in: effectiveTransactionIds.length > 0 ? effectiveTransactionIds : [-1] },
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

  const nonAccountableCategoryIds = await getNonAccountableCategoryIds();
  if (nonAccountableCategoryIds.length > 0) {
    where.NOT = [
      ...(Array.isArray(where.NOT) ? where.NOT : where.NOT ? [where.NOT] : []),
      { categoryId: { in: nonAccountableCategoryIds } },
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
  isNonAccountable?: boolean;
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
      color: data.color,
      icon: data.isNonAccountable ? NON_ACCOUNTABLE_CATEGORY_ICON : null,
      name: cleanName,
      type: data.type,
    },
  });
}

export async function updateTransactionCategory(
  id: number,
  data: {
    color?: null | string;
    isNonAccountable?: boolean;
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
      ...(data.isNonAccountable !== undefined && {
        icon: data.isNonAccountable ? NON_ACCOUNTABLE_CATEGORY_ICON : null,
      }),
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

async function ensurePersonalDrAutoCategoryRules() {
  const category =
    (await db.transactionCategory.findFirst({
      where: {
        name: PERSONAL_DR_CATEGORY_NAME,
        type: "EXPENSE",
      },
      select: { id: true },
    })) ??
    (await db.transactionCategory.create({
      data: {
        color: "#64748B",
        name: PERSONAL_DR_CATEGORY_NAME,
        type: "EXPENSE",
      },
      select: { id: true },
    }));

  for (const pattern of PERSONAL_DR_REFERENCE_PATTERNS) {
    const ruleName = `${PERSONAL_DR_RULE_NAME_PREFIX}: ${pattern}`;
    const existingRule = await db.financialAutoCategoryRule.findFirst({
      where: { name: ruleName },
      select: { id: true },
    });

    const ensuredRule = existingRule
      ? await db.financialAutoCategoryRule.update({
          where: { id: existingRule.id },
          data: {
            categoryId: category.id,
            commentContains: pattern,
            counterpartId: null,
            descriptionContains: null,
            isActive: true,
            maxAmount: null,
            minAmount: null,
            priority: 11000,
            type: "EXPENSE",
          },
          select: { id: true },
        })
      : await db.financialAutoCategoryRule.create({
          data: {
            categoryId: category.id,
            commentContains: pattern,
            counterpartId: null,
            descriptionContains: null,
            isActive: true,
            maxAmount: null,
            minAmount: null,
            name: ruleName,
            priority: 11000,
            type: "EXPENSE",
          },
          select: { id: true },
        });

    // Apply to historical records too, including already classified ones.
    await applySingleAutoCategoryRule(ensuredRule.id);
  }

  return category.id;
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

export type CompensationProfileInput = {
  categoryId: number;
  counterpartId?: null | number;
  isActive?: boolean;
  name: string;
  timezone?: string;
};

export type CompensationBudgetInput = {
  baseAmount: number;
  isLocked?: boolean;
  period: string;
};

export type ReallocateTransactionInput = {
  amount: number;
  fromPeriod: string;
  profileId: number;
  targetPeriod: string;
};

function signedAllocationAmount(allocationType: string, amount: number) {
  if (allocationType === "ROLLOVER_OUT") {
    return -Math.abs(amount);
  }
  return Math.abs(amount);
}

type CompensationProfileRow = {
  categoryId: number;
  categoryName: string;
  categoryType: TransactionType;
  counterpartBankAccountHolder: null | string;
  counterpartId: null | number;
  counterpartIdentificationNumber: null | string;
  id: number;
  isActive: boolean;
  name: string;
  timezone: string;
};

function mapCompensationProfileRow(row: CompensationProfileRow) {
  return {
    category: {
      id: row.categoryId,
      name: row.categoryName,
      type: row.categoryType,
    },
    categoryId: row.categoryId,
    counterpart:
      row.counterpartId == null
        ? null
        : {
            bankAccountHolder: row.counterpartBankAccountHolder ?? "",
            id: row.counterpartId,
            identificationNumber: row.counterpartIdentificationNumber ?? "",
          },
    counterpartId: row.counterpartId,
    id: row.id,
    isActive: row.isActive,
    name: row.name,
    timezone: row.timezone,
  };
}

async function getCompensationProfileById(id: number) {
  const rows = await db.$queryRaw<CompensationProfileRow[]>`
    SELECT
      cp.id AS id,
      cp.name AS name,
      cp.is_active AS "isActive",
      cp.timezone AS timezone,
      cp.category_id AS "categoryId",
      tc.name AS "categoryName",
      tc.type AS "categoryType",
      cp.counterpart_id AS "counterpartId",
      c.bank_account_holder AS "counterpartBankAccountHolder",
      c.identification_number AS "counterpartIdentificationNumber"
    FROM compensation_profiles cp
    INNER JOIN transaction_categories tc ON tc.id = cp.category_id
    LEFT JOIN counterparts c ON c.id = cp.counterpart_id
    WHERE cp.id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapCompensationProfileRow(row) : null;
}

export async function listCompensationProfiles() {
  const rows = await db.$queryRaw<CompensationProfileRow[]>`
    SELECT
      cp.id AS id,
      cp.name AS name,
      cp.is_active AS "isActive",
      cp.timezone AS timezone,
      cp.category_id AS "categoryId",
      tc.name AS "categoryName",
      tc.type AS "categoryType",
      cp.counterpart_id AS "counterpartId",
      c.bank_account_holder AS "counterpartBankAccountHolder",
      c.identification_number AS "counterpartIdentificationNumber"
    FROM compensation_profiles cp
    INNER JOIN transaction_categories tc ON tc.id = cp.category_id
    LEFT JOIN counterparts c ON c.id = cp.counterpart_id
    ORDER BY cp.is_active DESC, cp.name ASC
  `;
  return rows.map(mapCompensationProfileRow);
}

export async function createCompensationProfile(data: CompensationProfileInput) {
  const category = await db.transactionCategory.findUnique({
    where: { id: data.categoryId },
    select: { id: true, type: true },
  });
  if (!category) {
    throw new Error("Categoría no encontrada");
  }
  if (category.type !== "EXPENSE") {
    throw new Error("Solo se permiten perfiles de compensación para categorías de egreso.");
  }

  if (data.counterpartId != null) {
    const counterpart = await db.counterpart.findUnique({
      where: { id: data.counterpartId },
      select: { id: true },
    });
    if (!counterpart) {
      throw new Error("Contraparte no encontrada");
    }
  }

  const name = data.name.trim();
  if (!name) {
    throw new Error("El nombre del perfil es obligatorio");
  }

  const rows = await db.$queryRaw<Array<{ id: number }>>`
    INSERT INTO compensation_profiles (
      name, category_id, counterpart_id, is_active, timezone, created_at, updated_at
    )
    VALUES (
      ${name},
      ${data.categoryId},
      ${data.counterpartId ?? null},
      ${data.isActive ?? true},
      ${data.timezone?.trim() || "America/Santiago"},
      NOW(),
      NOW()
    )
    RETURNING id
  `;
  const createdId = rows[0]?.id;
  if (!createdId) {
    throw new Error("No se pudo crear el perfil de compensación");
  }
  const created = await getCompensationProfileById(createdId);
  if (!created) {
    throw new Error("No se pudo cargar el perfil creado");
  }
  return created;
}

export async function updateCompensationProfile(
  id: number,
  data: Partial<CompensationProfileInput>,
) {
  if (data.categoryId != null) {
    const category = await db.transactionCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true, type: true },
    });
    if (!category) {
      throw new Error("Categoría no encontrada");
    }
    if (category.type !== "EXPENSE") {
      throw new Error("Solo se permiten perfiles de compensación para categorías de egreso.");
    }
  }

  if (data.counterpartId != null) {
    const counterpart = await db.counterpart.findUnique({
      where: { id: data.counterpartId },
      select: { id: true },
    });
    if (!counterpart) {
      throw new Error("Contraparte no encontrada");
    }
  }

  const existing = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM compensation_profiles WHERE id = ${id} LIMIT 1
  `;
  if (existing.length === 0) {
    throw new Error("Perfil de compensación no encontrado");
  }

  await db.$executeRaw`
    UPDATE compensation_profiles
    SET
      name = COALESCE(${data.name?.trim() || null}, name),
      category_id = COALESCE(${data.categoryId ?? null}, category_id),
      counterpart_id = CASE
        WHEN ${data.counterpartId !== undefined}
        THEN ${data.counterpartId ?? null}
        ELSE counterpart_id
      END,
      is_active = COALESCE(${data.isActive ?? null}, is_active),
      timezone = COALESCE(${data.timezone?.trim() || null}, timezone),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  const updated = await getCompensationProfileById(id);
  if (!updated) {
    throw new Error("No se pudo cargar el perfil actualizado");
  }
  return updated;
}

export async function upsertCompensationPeriodBudget(
  profileId: number,
  data: CompensationBudgetInput,
) {
  assertPeriodOrThrow(data.period);
  const profile = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM compensation_profiles WHERE id = ${profileId} LIMIT 1
  `;
  if (profile.length === 0) {
    throw new Error("Perfil de compensación no encontrado");
  }

  const rows = await db.$queryRaw<
    Array<{ baseAmount: number; id: number; isLocked: boolean; period: string; profileId: number }>
  >`
    INSERT INTO compensation_period_budgets (
      profile_id, period, base_amount, is_locked, created_at, updated_at
    )
    VALUES (
      ${profileId},
      ${data.period},
      ${new Decimal(data.baseAmount)},
      ${data.isLocked ?? false},
      NOW(),
      NOW()
    )
    ON CONFLICT (profile_id, period)
    DO UPDATE SET
      base_amount = EXCLUDED.base_amount,
      is_locked = COALESCE(${data.isLocked ?? null}, compensation_period_budgets.is_locked),
      updated_at = NOW()
    RETURNING
      id,
      profile_id AS "profileId",
      period,
      base_amount AS "baseAmount",
      is_locked AS "isLocked"
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("No se pudo guardar el presupuesto");
  }
  return row;
}

export async function listCompensationPeriodLedger(
  profileId: number,
  fromPeriod: string,
  toPeriod: string,
) {
  assertPeriodOrThrow(fromPeriod);
  assertPeriodOrThrow(toPeriod);
  if (fromPeriod > toPeriod) {
    throw new Error("Rango de periodos inválido");
  }

  const [budgets, allocations] = await Promise.all([
    db.$queryRaw<Array<{ baseAmount: number; isLocked: boolean; period: string }>>`
      SELECT
        period,
        base_amount AS "baseAmount",
        is_locked AS "isLocked"
      FROM compensation_period_budgets
      WHERE profile_id = ${profileId}
        AND period >= ${fromPeriod}
        AND period <= ${toPeriod}
      ORDER BY period ASC
    `,
    db.$queryRaw<Array<{ allocationType: string; amount: number; period: string }>>`
      SELECT
        period,
        allocation_type AS "allocationType",
        amount
      FROM financial_transaction_allocations
      WHERE profile_id = ${profileId}
        AND period >= ${fromPeriod}
        AND period <= ${toPeriod}
      ORDER BY period ASC
    `,
  ]);

  const periods: string[] = [];
  let cursor = `${fromPeriod}-01T00:00:00.000Z`;
  while (cursor.slice(0, 7) <= toPeriod) {
    periods.push(cursor.slice(0, 7));
    const date = new Date(cursor);
    date.setUTCMonth(date.getUTCMonth() + 1);
    cursor = date.toISOString();
  }

  const budgetByPeriod = new Map(
    budgets.map((item) => [
      item.period,
      { amount: Number(item.baseAmount), isLocked: item.isLocked },
    ]),
  );
  const allocatedByPeriod = new Map<string, number>();
  for (const allocation of allocations) {
    const current = allocatedByPeriod.get(allocation.period) ?? 0;
    allocatedByPeriod.set(
      allocation.period,
      current + signedAllocationAmount(allocation.allocationType, Number(allocation.amount)),
    );
  }

  return periods.map((period) => {
    const budget = budgetByPeriod.get(period);
    const allocated = allocatedByPeriod.get(period) ?? 0;
    const budgetAmount = budget?.amount ?? 0;
    return {
      allocatedAmount: allocated,
      budgetAmount,
      isLocked: budget?.isLocked ?? false,
      period,
      variance: budgetAmount - allocated,
    };
  });
}

export async function reallocateFinancialTransaction(
  transactionId: number,
  data: ReallocateTransactionInput,
) {
  assertPeriodOrThrow(data.fromPeriod);
  assertPeriodOrThrow(data.targetPeriod);
  if (data.targetPeriod <= data.fromPeriod) {
    throw new AppError(422, {
      code: "INVALID_TARGET_PERIOD",
      message: "El periodo destino debe ser al menos un mes posterior al origen",
    });
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new AppError(422, {
      code: "INVALID_AMOUNT",
      message: "El monto a reasignar debe ser mayor a 0",
    });
  }

  return db.$transaction(async (tx) => {
    const [profile, transaction] = await Promise.all([
      tx.$queryRaw<
        Array<{ categoryId: number; counterpartId: null | number; id: number; isActive: boolean }>
      >`
        SELECT
          id,
          category_id AS "categoryId",
          counterpart_id AS "counterpartId",
          is_active AS "isActive"
        FROM compensation_profiles
        WHERE id = ${data.profileId}
        LIMIT 1
      `,
      tx.financialTransaction.findUnique({
        where: { id: transactionId },
        select: {
          amount: true,
          categoryId: true,
          counterpartId: true,
          date: true,
          id: true,
          type: true,
        },
      }),
    ]);

    const profileRow = profile[0];
    if (!profileRow || !profileRow.isActive) {
      throw new AppError(404, {
        code: "COMPENSATION_PROFILE_NOT_AVAILABLE",
        message: "Perfil de compensación no encontrado o inactivo",
      });
    }
    if (!transaction) {
      throw new AppError(404, {
        code: "TRANSACTION_NOT_FOUND",
        message: "Transacción no encontrada",
      });
    }
    if (transaction.categoryId == null || transaction.categoryId !== profileRow.categoryId) {
      throw new AppError(409, {
        code: "PROFILE_CATEGORY_MISMATCH",
        message: "La transacción no corresponde a la categoría del perfil",
      });
    }
    if (
      profileRow.counterpartId != null &&
      transaction.counterpartId !== profileRow.counterpartId
    ) {
      throw new AppError(409, {
        code: "PROFILE_COUNTERPART_MISMATCH",
        message: "La contraparte de la transacción no coincide con el perfil",
      });
    }

    const lockedPeriods = await tx.$queryRaw<Array<{ isLocked: boolean }>>`
      SELECT is_locked AS "isLocked"
      FROM compensation_period_budgets
      WHERE profile_id = ${profileRow.id}
        AND (period = ${data.fromPeriod} OR period = ${data.targetPeriod})
    `;
    if (lockedPeriods.some((item) => item.isLocked)) {
      throw new AppError(409, {
        code: "LOCKED_PERIOD",
        message: "No se puede reasignar: el periodo origen o destino está bloqueado.",
      });
    }

    const originalAllocation = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM financial_transaction_allocations
      WHERE profile_id = ${profileRow.id}
        AND transaction_id = ${transaction.id}
        AND allocation_type = 'ORIGINAL'
      LIMIT 1
    `;
    let sourceAllocationId = originalAllocation[0]?.id;
    if (!sourceAllocationId) {
      const createdOriginal = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO financial_transaction_allocations (
          transaction_id, profile_id, period, amount, allocation_type, created_at, updated_at
        )
        VALUES (
          ${transaction.id},
          ${profileRow.id},
          ${toPeriod(transaction.date)},
          ${Math.abs(Number(transaction.amount))},
          'ORIGINAL',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      sourceAllocationId = createdOriginal[0]?.id;
    }

    const availableInFromPeriod = (
      await tx.$queryRaw<Array<{ allocationType: string; amount: number }>>`
        SELECT
          allocation_type AS "allocationType",
          amount
        FROM financial_transaction_allocations
        WHERE period = ${data.fromPeriod}
          AND profile_id = ${profileRow.id}
          AND transaction_id = ${transaction.id}
      `
    ).reduce(
      (acc, allocation) =>
        acc + signedAllocationAmount(allocation.allocationType, Number(allocation.amount)),
      0,
    );

    if (data.amount > availableInFromPeriod) {
      throw new AppError(409, {
        code: "INSUFFICIENT_AMOUNT_IN_SOURCE_PERIOD",
        message: "Monto excede lo disponible en el periodo de origen",
      });
    }

    const rolloverOut = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO financial_transaction_allocations (
        transaction_id, profile_id, period, amount, allocation_type, source_allocation_id, created_at, updated_at
      )
      VALUES (
        ${transaction.id},
        ${profileRow.id},
        ${data.fromPeriod},
        ${Number(data.amount)},
        'ROLLOVER_OUT',
        ${sourceAllocationId},
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const outId = rolloverOut[0]?.id;
    const reallocationAmount = Number(data.amount);
    const rolloverIn = await tx.$queryRaw<
      Array<{
        allocationType: string;
        amount: number;
        id: number;
        period: string;
        profileId: number;
        transactionId: number;
      }>
    >`
      INSERT INTO financial_transaction_allocations (
        transaction_id, profile_id, period, amount, allocation_type, source_allocation_id, created_at, updated_at
      )
      VALUES (
        ${transaction.id},
        ${profileRow.id},
        ${data.targetPeriod},
        ${reallocationAmount},
        'ROLLOVER_IN',
        ${outId ?? null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        transaction_id AS "transactionId",
        profile_id AS "profileId",
        period,
        amount,
        allocation_type AS "allocationType"
    `;

    return rolloverIn[0];
  });
}
