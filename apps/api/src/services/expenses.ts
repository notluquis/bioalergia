import { db, kysely } from "@finanzas/db";
import type { ExpenseRecurrence, ExpenseScope, ExpenseSource, ExpenseStatus } from "@finanzas/db";
import { Decimal } from "decimal.js";
import { sql } from "kysely";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpenseServiceFilters {
  isActive?: boolean;
  scope?: string;
}

export interface ExpenseFilters {
  from?: string;
  scope?: string;
  serviceId?: null | number;
  status?: string;
  to?: string;
}

export interface ExpenseStatsFilters {
  from?: string;
  groupBy?: string;
  scope?: string;
  to?: string;
}

// ─── ExpenseService mapper ─────────────────────────────────────────────────────

function mapExpenseService(service: {
  billingDay: null | number;
  category: null | string;
  createdAt: Date;
  defaultAmount: { toNumber?: () => number } | null | number;
  detail: null | string;
  dueDateRule: null | string;
  endDate: Date | null;
  id: number;
  isActive: boolean;
  isFixed: boolean;
  name: string;
  notes: null | string;
  publicId: string;
  recurrence: string;
  scope: string;
  startDate: Date | null;
  tags: string[];
  updatedAt: Date;
}) {
  return {
    billingDay: service.billingDay,
    category: service.category,
    createdAt: service.createdAt,
    defaultAmount:
      service.defaultAmount == null
        ? null
        : typeof service.defaultAmount === "number"
          ? service.defaultAmount
          : typeof (service.defaultAmount as { toNumber?: () => number }).toNumber === "function"
            ? (service.defaultAmount as { toNumber: () => number }).toNumber()
            : Number(service.defaultAmount),
    detail: service.detail,
    dueDateRule: service.dueDateRule,
    endDate: service.endDate,
    id: service.id,
    isActive: service.isActive,
    isFixed: service.isFixed,
    name: service.name,
    notes: service.notes,
    publicId: service.publicId,
    recurrence: service.recurrence as ExpenseRecurrence,
    scope: service.scope as ExpenseScope,
    startDate: service.startDate,
    tags: service.tags,
    updatedAt: service.updatedAt,
  };
}

// ─── ExpenseService CRUD ──────────────────────────────────────────────────────

export async function listExpenseServices(filters: ExpenseServiceFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.isActive !== undefined) {
    where["isActive"] = filters.isActive;
  }

  if (filters.scope !== undefined) {
    where["scope"] = filters.scope;
  }

  const services = await db.expenseService.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return services.map(mapExpenseService);
}

export async function getExpenseService(id: number) {
  const service = await db.expenseService.findFirst({
    where: { id },
  });
  return service ? mapExpenseService(service) : null;
}

export async function createExpenseService(payload: {
  billingDay?: null | number;
  category?: null | string;
  defaultAmount?: null | number;
  detail?: null | string;
  dueDateRule?: null | string;
  endDate?: null | string;
  isActive?: boolean;
  isFixed?: boolean;
  name: string;
  notes?: null | string;
  recurrence?: ExpenseRecurrence;
  scope: string;
  startDate?: null | string;
  tags?: string[];
}) {
  const service = await db.expenseService.create({
    data: {
      billingDay: payload.billingDay ?? null,
      category: payload.category ?? null,
      defaultAmount: payload.defaultAmount != null ? new Decimal(payload.defaultAmount) : null,
      detail: payload.detail ?? null,
      dueDateRule: payload.dueDateRule ?? null,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      isActive: payload.isActive ?? true,
      isFixed: payload.isFixed ?? false,
      name: payload.name,
      notes: payload.notes ?? null,
      recurrence: payload.recurrence ?? "MONTHLY",
      scope: payload.scope as never,
      startDate: payload.startDate ? new Date(payload.startDate) : null,
      tags: payload.tags ?? [],
    },
  });
  return mapExpenseService(service);
}

export async function updateExpenseService(
  id: number,
  payload: {
    billingDay?: null | number;
    category?: null | string;
    defaultAmount?: null | number;
    detail?: null | string;
    dueDateRule?: null | string;
    endDate?: null | string;
    isActive?: boolean;
    isFixed?: boolean;
    name?: string;
    notes?: null | string;
    recurrence?: ExpenseRecurrence;
    scope?: string;
    startDate?: null | string;
    tags?: string[];
  }
) {
  const service = await db.expenseService.update({
    where: { id },
    data: {
      ...(payload.billingDay !== undefined && { billingDay: payload.billingDay }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.defaultAmount !== undefined && {
        defaultAmount: payload.defaultAmount != null ? new Decimal(payload.defaultAmount) : null,
      }),
      ...(payload.detail !== undefined && { detail: payload.detail }),
      ...(payload.dueDateRule !== undefined && { dueDateRule: payload.dueDateRule }),
      ...(payload.endDate !== undefined && {
        endDate: payload.endDate ? new Date(payload.endDate) : null,
      }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      ...(payload.isFixed !== undefined && { isFixed: payload.isFixed }),
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
      ...(payload.recurrence !== undefined && { recurrence: payload.recurrence }),
      ...(payload.scope !== undefined && { scope: payload.scope as never }),
      ...(payload.startDate !== undefined && {
        startDate: payload.startDate ? new Date(payload.startDate) : null,
      }),
      ...(payload.tags !== undefined && { tags: payload.tags }),
    },
  });
  return mapExpenseService(service);
}

export async function deleteExpenseService(id: number) {
  return db.expenseService.delete({
    where: { id },
  });
}

// ─── Expense helpers ──────────────────────────────────────────────────────────

function buildExpenseItem(
  expense: {
    amountApplied: { toNumber?: () => number } | number;
    amountExpected: { toNumber?: () => number } | number;
    category: null | string;
    createdAt: Date;
    detail: null | string;
    dueDate: Date | null;
    expenseMonth: string;
    name: string;
    notes: null | string;
    publicId: string;
    scope: string;
    serviceId: null | number;
    source: string;
    status: string;
    tags: string[];
    updatedAt: Date;
  },
  transactionCount: number,
  amountApplied: number
) {
  return {
    amountApplied,
    amountExpected: Number(expense.amountExpected),
    category: expense.category,
    createdAt: expense.createdAt,
    detail: expense.detail,
    dueDate: expense.dueDate,
    expenseMonth: expense.expenseMonth,
    name: expense.name,
    notes: expense.notes,
    publicId: expense.publicId,
    scope: expense.scope as ExpenseScope,
    serviceId: expense.serviceId,
    source: expense.source as ExpenseSource,
    status: expense.status as ExpenseStatus,
    tags: expense.tags,
    transactionCount,
    updatedAt: expense.updatedAt,
  };
}

// ─── Expense CRUD ─────────────────────────────────────────────────────────────

export async function listExpenses(filters: ExpenseFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.from !== undefined) {
    where["expenseMonth"] = { ...(where["expenseMonth"] as object | undefined), gte: filters.from };
  }

  if (filters.to !== undefined) {
    where["expenseMonth"] = { ...(where["expenseMonth"] as object | undefined), lte: filters.to };
  }

  if (filters.scope !== undefined) {
    where["scope"] = filters.scope;
  }

  if (filters.status !== undefined) {
    where["status"] = filters.status;
  }

  if (filters.serviceId !== undefined) {
    where["serviceId"] = filters.serviceId;
  }

  const expenses = await db.expense.findMany({
    where,
    include: {
      _count: { select: { transactions: true } },
      transactions: {
        select: { amount: true },
      },
    },
    orderBy: [{ expenseMonth: "desc" }, { name: "asc" }],
  });

  return expenses.map((e: (typeof expenses)[number]) => {
    const amountApplied = e.transactions.reduce(
      (sum: number, tx: (typeof e.transactions)[number]) => sum + Number(tx.amount),
      0
    );
    return buildExpenseItem(e, e._count.transactions, amountApplied);
  });
}

export async function getExpense(publicId: string) {
  const expense = await db.expense.findFirst({
    where: { publicId },
    include: {
      _count: { select: { transactions: true } },
      transactions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!expense) {
    return null;
  }

  const amountApplied = expense.transactions.reduce(
    (sum: number, tx: (typeof expense.transactions)[number]) => sum + Number(tx.amount),
    0
  );

  // For each expense transaction, fetch the settlement transaction to get
  // description, direction (transactionType), and timestamp (transactionDate)
  const txDetails = await Promise.all(
    expense.transactions.map(async (et: (typeof expense.transactions)[number]) => {
      const settlement = await db.settlementTransaction.findFirst({
        where: { id: et.transactionId },
        select: {
          description: true,
          transactionDate: true,
          transactionType: true,
        },
      });

      return {
        amount: Number(et.amount),
        description: settlement?.description ?? null,
        direction: settlement?.transactionType ?? "UNKNOWN",
        timestamp: settlement?.transactionDate ?? et.createdAt,
        transactionId: et.transactionId,
      };
    })
  );

  return {
    ...buildExpenseItem(expense, expense._count.transactions, amountApplied),
    transactions: txDetails,
  };
}

export async function createExpense(payload: {
  amountExpected: number;
  category?: null | string;
  detail?: null | string;
  dueDate?: null | string;
  expenseMonth: string;
  name: string;
  notes?: null | string;
  scope: string;
  serviceId?: null | number;
  source?: string;
  status?: string;
  tags?: string[];
}) {
  const expense = await db.expense.create({
    data: {
      amountExpected: new Decimal(payload.amountExpected),
      category: payload.category ?? null,
      detail: payload.detail ?? null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      expenseMonth: payload.expenseMonth,
      name: payload.name,
      notes: payload.notes ?? null,
      scope: payload.scope as never,
      serviceId: payload.serviceId ?? null,
      source: (payload.source ?? "MANUAL") as never,
      status: (payload.status ?? "PENDING") as never,
      tags: payload.tags ?? [],
    },
  });

  return {
    ...buildExpenseItem(expense, 0, 0),
    transactions: [] as {
      amount: number;
      description: null | string;
      direction: string;
      timestamp: Date;
      transactionId: number;
    }[],
  };
}

export async function updateExpense(
  publicId: string,
  payload: {
    amountExpected?: number;
    category?: null | string;
    detail?: null | string;
    dueDate?: null | string;
    expenseMonth?: string;
    name?: string;
    notes?: null | string;
    scope?: string;
    serviceId?: null | number;
    source?: string;
    status?: string;
    tags?: string[];
  }
) {
  await db.expense.update({
    where: { publicId },
    data: {
      ...(payload.amountExpected !== undefined && {
        amountExpected: new Decimal(payload.amountExpected),
      }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.detail !== undefined && { detail: payload.detail }),
      ...(payload.dueDate !== undefined && {
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      }),
      ...(payload.expenseMonth !== undefined && { expenseMonth: payload.expenseMonth }),
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
      ...(payload.scope !== undefined && { scope: payload.scope as never }),
      ...(payload.serviceId !== undefined && { serviceId: payload.serviceId }),
      ...(payload.source !== undefined && { source: payload.source as never }),
      ...(payload.status !== undefined && { status: payload.status as never }),
      ...(payload.tags !== undefined && { tags: payload.tags }),
    },
  });

  const updated = await getExpense(publicId);

  if (!updated) {
    throw new Error(`Expense ${publicId} not found after update`);
  }

  return updated;
}

async function recalcAmountApplied(expenseId: number): Promise<number> {
  const txs = await db.expenseTransaction.findMany({
    where: { expenseId },
    select: { amount: true },
  });
  return txs.reduce((sum, tx) => sum + Number(tx.amount), 0);
}

export async function linkTransaction(publicId: string, transactionId: number, amount?: number) {
  // Resolve expense id
  const expense = await db.expense.findFirst({
    where: { publicId },
    select: { id: true },
  });

  if (!expense) {
    return null;
  }

  // Determine amount — fall back to settlement transaction amount if not provided
  let resolvedAmount = amount;

  if (resolvedAmount === undefined) {
    const settlement = await db.settlementTransaction.findFirst({
      where: { id: transactionId },
      select: { transactionAmount: true },
    });
    resolvedAmount = settlement ? Number(settlement.transactionAmount) : 0;
  }

  await db.expenseTransaction.upsert({
    where: {
      expenseId_transactionId: {
        expenseId: expense.id,
        transactionId,
      },
    },
    create: {
      expenseId: expense.id,
      transactionId,
      amount: new Decimal(resolvedAmount),
    },
    update: {
      amount: new Decimal(resolvedAmount),
    },
  });

  const newAmountApplied = await recalcAmountApplied(expense.id);

  await db.expense.update({
    where: { id: expense.id },
    data: { amountApplied: new Decimal(newAmountApplied) },
  });

  return newAmountApplied;
}

export async function unlinkTransaction(publicId: string, transactionId: number) {
  const expense = await db.expense.findFirst({
    where: { publicId },
    select: { id: true },
  });

  if (!expense) {
    return null;
  }

  await db.expenseTransaction.delete({
    where: {
      expenseId_transactionId: {
        expenseId: expense.id,
        transactionId,
      },
    },
  });

  const newAmountApplied = await recalcAmountApplied(expense.id);

  await db.expense.update({
    where: { id: expense.id },
    data: { amountApplied: new Decimal(newAmountApplied) },
  });

  return newAmountApplied;
}

// ─── Generate from templates ──────────────────────────────────────────────────

export async function generateExpensesFromTemplates(
  month: string,
  overwrite = false
): Promise<{ created: number; skipped: number }> {
  const monthStart = new Date(`${month}-01`);

  const services = await db.expenseService.findMany({
    where: { isActive: true, recurrence: "MONTHLY" },
  });

  let created = 0;
  let skipped = 0;

  for (const service of services) {
    // Check date bounds
    if (service.startDate && monthStart < service.startDate) {
      skipped++;
      continue;
    }
    if (service.endDate && monthStart > service.endDate) {
      skipped++;
      continue;
    }

    // Check if expense already exists for this month+service
    const existing = await db.expense.findFirst({
      where: { expenseMonth: month, serviceId: service.id },
    });

    if (existing) {
      if (!overwrite) {
        skipped++;
        continue;
      }
      // overwrite: update the existing one
      await db.expense.update({
        where: { id: existing.id },
        data: {
          amountExpected: new Decimal(Number(service.defaultAmount ?? 0)),
          name: service.name,
          scope: service.scope,
          source: "TEMPLATE",
          status: "PENDING",
        },
      });
      created++;
      continue;
    }

    await db.expense.create({
      data: {
        amountExpected: new Decimal(Number(service.defaultAmount ?? 0)),
        category: service.category ?? null,
        detail: service.detail ?? null,
        expenseMonth: month,
        name: service.name,
        notes: service.notes ?? null,
        scope: service.scope,
        serviceId: service.id,
        source: "TEMPLATE",
        status: "PENDING",
        tags: service.tags,
      },
    });

    created++;
  }

  return { created, skipped };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface StatsRow {
  expenseCount: number;
  period: string;
  scope: ExpenseScope | null;
  totalApplied: number;
  totalExpected: number;
}

export async function getExpenseStats(filters: ExpenseStatsFilters = {}): Promise<StatsRow[]> {
  const { from, to, scope, groupBy = "month" } = filters;

  let periodExpr: ReturnType<typeof sql>;

  if (groupBy === "year") {
    periodExpr = sql`TO_CHAR(TO_DATE("expenseMonth", 'YYYY-MM'), 'YYYY')`;
  } else if (groupBy === "quarter") {
    periodExpr = sql`TO_CHAR(TO_DATE("expenseMonth", 'YYYY-MM'), 'YYYY-"Q"Q')`;
  } else {
    // month (default)
    periodExpr = sql`"expenseMonth"`;
  }

  type StatsQueryResult = {
    expenseCount: number;
    period: string;
    scope: null | string;
    totalApplied: number;
    totalExpected: number;
  };

  let query = db.$qb
    .selectFrom("Expense")
    .select([
      sql<string>`${periodExpr}`.as("period"),
      sql<null | string>`"scope"`.as("scope"),
      sql<number>`COUNT(*)::int`.as("expenseCount"),
      sql<number>`SUM("amountExpected")::float`.as("totalExpected"),
      sql<number>`SUM("amountApplied")::float`.as("totalApplied"),
    ])
    .groupBy([sql`${periodExpr}`, sql`"scope"`])
    .orderBy(sql`${periodExpr}`, "asc") as unknown as import("kysely").SelectQueryBuilder<
    Record<string, Record<string, unknown>>,
    string,
    StatsQueryResult
  >;

  if (from !== undefined) {
    query = query.where(sql`"expenseMonth"`, ">=", from);
  }

  if (to !== undefined) {
    query = query.where(sql`"expenseMonth"`, "<=", to);
  }

  if (scope !== undefined) {
    query = query.where(sql`"scope"`, "=", scope);
  }

  const rows = await query.execute();

  return rows.map((row) => ({
    expenseCount: Number(row.expenseCount),
    period: row.period,
    scope: (row.scope ?? null) as ExpenseScope | null,
    totalApplied: Number(row.totalApplied ?? 0),
    totalExpected: Number(row.totalExpected ?? 0),
  }));
}
