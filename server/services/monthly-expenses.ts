import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { randomUUID } from "node:crypto";

export async function listMonthlyExpenses(filters?: {
  from?: string;
  to?: string;
  status?: ("OPEN" | "CLOSED")[];
  serviceId?: number | null;
}) {
  const where: Prisma.MonthlyExpenseWhereInput = {};

  if (filters?.from || filters?.to) {
    where.expenseDate = {};
    if (filters.from) {
      where.expenseDate.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.expenseDate.lte = new Date(filters.to);
    }
  }

  if (filters?.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }

  if (typeof filters?.serviceId === "number") {
    where.serviceId = filters.serviceId;
  } else if (filters?.serviceId === null) {
    where.serviceId = null;
  }

  const expenses = await prisma.monthlyExpense.findMany({
    where,
    include: {
      transactions: true,
    },
    orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
  });

  return expenses.map((expense: Prisma.MonthlyExpenseGetPayload<{ include: { transactions: true } }>) => {
    const amountApplied = expense.transactions.reduce(
      (sum: number, t: { amount: number }) => sum + Number(t.amount),
      0
    );
    const transactionCount = expense.transactions.length;

    return {
      ...expense,
      amountApplied,
      transactionCount,
    };
  });
}

export async function getMonthlyExpenseDetail(publicId: string) {
  const expense = await prisma.monthlyExpense.findUnique({
    where: { publicId },
    include: {
      transactions: {
        include: {
          transaction: true,
        },
        orderBy: {
          transaction: {
            timestamp: "desc",
          },
        },
      },
    },
  });

  if (!expense) return null;

  const amountApplied = expense.transactions.reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

  return {
    ...expense,
    amountApplied,
    transactionCount: expense.transactions.length,
    transactions: expense.transactions.map(
      (met: {
        transactionId: bigint;
        amount: number;
        transaction: { timestamp: Date; description: string | null; direction: string };
      }) => ({
        transaction_id: met.transactionId,
        amount: Number(met.amount),
        timestamp: met.transaction.timestamp.toISOString(),
        description: met.transaction.description,
        direction: met.transaction.direction,
      })
    ),
  };
}

export async function createMonthlyExpense(payload: {
  name: string;
  category: string | null;
  amountExpected: number;
  expenseDate: string;
  notes: string | null;
  source?: "MANUAL" | "TRANSACTION" | "SERVICE";
  serviceId: number | null;
  tags: string[];
  status?: "OPEN" | "CLOSED";
}) {
  const publicId = randomUUID();
  const tags = payload.tags.length > 0 ? payload.tags : null;

  const expense = await prisma.monthlyExpense.create({
    data: {
      publicId,
      name: payload.name,
      category: payload.category,
      amountExpected: payload.amountExpected,
      expenseDate: new Date(payload.expenseDate),
      notes: payload.notes,
      source: payload.source ?? "MANUAL",
      serviceId: payload.serviceId,
      tags: tags as Prisma.InputJsonValue,
      status: payload.status ?? "OPEN",
    },
  });

  const detail = await getMonthlyExpenseDetail(expense.publicId);
  if (!detail) {
    throw new Error("No se pudo crear el gasto mensual");
  }
  return detail;
}

export async function updateMonthlyExpense(
  publicId: string,
  payload: {
    name: string;
    category: string | null;
    amountExpected: number;
    expenseDate: string;
    notes: string | null;
    source?: "MANUAL" | "TRANSACTION" | "SERVICE";
    serviceId: number | null;
    tags: string[];
    status?: "OPEN" | "CLOSED";
  }
) {
  const tags = payload.tags.length > 0 ? payload.tags : null;

  await prisma.monthlyExpense.update({
    where: { publicId },
    data: {
      name: payload.name,
      category: payload.category,
      amountExpected: payload.amountExpected,
      expenseDate: new Date(payload.expenseDate),
      notes: payload.notes,
      source: payload.source ?? "MANUAL",
      serviceId: payload.serviceId,
      tags: tags as Prisma.InputJsonValue,
      status: payload.status ?? "OPEN",
    },
  });

  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) {
    throw new Error("Gasto mensual no encontrado");
  }
  return detail;
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: {
    transactionId: number;
    amount?: number;
  }
) {
  const expense = await prisma.monthlyExpense.findUnique({
    where: { publicId },
  });

  if (!expense) throw new Error("Gasto mensual no encontrado");

  const transaction = await prisma.transaction.findUnique({
    where: { id: payload.transactionId },
  });

  if (!transaction) throw new Error("Transacción no encontrada");

  const txAmount = Math.abs(Number(transaction.amount));
  const amount = payload.amount != null ? payload.amount : txAmount;

  await prisma.monthlyExpenseTransaction.upsert({
    where: {
      monthlyExpenseId_transactionId: {
        monthlyExpenseId: expense.id,
        transactionId: payload.transactionId,
      },
    },
    create: {
      monthlyExpenseId: expense.id,
      transactionId: payload.transactionId,
      amount,
    },
    update: {
      amount,
    },
  });

  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) throw new Error("Gasto mensual no encontrado");
  return detail;
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  const expense = await prisma.monthlyExpense.findUnique({
    where: { publicId },
  });

  if (!expense) throw new Error("Gasto mensual no encontrado");

  await prisma.monthlyExpenseTransaction.deleteMany({
    where: {
      monthlyExpenseId: expense.id,
      transactionId,
    },
  });

  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) throw new Error("Gasto mensual no encontrado");
  return detail;
}

export async function getMonthlyExpenseStats(options: {
  from?: string;
  to?: string;
  groupBy?: "day" | "week" | "month" | "quarter" | "year";
  category?: string | null;
}) {
  const groupBy = options.groupBy ?? "month";
  const where: Prisma.MonthlyExpenseWhereInput = {};

  if (options.from || options.to) {
    where.expenseDate = {};
    if (options.from) {
      where.expenseDate.gte = new Date(options.from);
    }
    if (options.to) {
      where.expenseDate.lte = new Date(options.to);
    }
  }

  if (typeof options.category === "string") {
    if (options.category.length > 0) {
      where.category = options.category;
    } else {
      where.category = null;
    }
  }

  // For complex grouping, we'll use raw SQL
  let expr = "DATE_FORMAT(me.expense_date, '%Y-%m-01')";
  if (groupBy === "day") expr = "DATE_FORMAT(me.expense_date, '%Y-%m-%d')";
  if (groupBy === "week")
    expr = "STR_TO_DATE(CONCAT(YEAR(me.expense_date), '-', LPAD(WEEK(me.expense_date, 1), 2, '0'), '-1'), '%X-%V-%w')";
  if (groupBy === "quarter") expr = "CONCAT(YEAR(me.expense_date), '-Q', QUARTER(me.expense_date))";
  if (groupBy === "year") expr = "DATE_FORMAT(me.expense_date, '%Y-01-01')";

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.from) {
    conditions.push("me.expense_date >= ?");
    params.push(options.from);
  }
  if (options.to) {
    conditions.push("me.expense_date <= ?");
    params.push(options.to);
  }
  if (typeof options.category === "string") {
    if (options.category.length) {
      conditions.push("me.category = ?");
      params.push(options.category);
    } else {
      conditions.push("me.category IS NULL");
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT ${expr} AS period_key,
           SUM(me.amount_expected) AS total_expected,
           COALESCE(SUM(met.amount), 0) AS total_applied,
           COUNT(DISTINCT me.id) AS expense_count
      FROM monthly_expenses me
      LEFT JOIN monthly_expense_transactions met ON met.monthly_expense_id = me.id
     ${whereClause}
     GROUP BY period_key
     ORDER BY period_key DESC
  `;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      period_key: string | null;
      total_expected: number | null;
      total_applied: number | null;
      expense_count: number | null;
    }>
  >(sql, ...params);

  return rows.map(
    (row: {
      period_key: string | null;
      total_expected: number | null;
      total_applied: number | null;
      expense_count: number | null;
    }) => ({
      period: row.period_key ?? "unknown",
      total_expected: Number(row.total_expected ?? 0),
      total_applied: Number(row.total_applied ?? 0),
      expense_count: Number(row.expense_count ?? 0),
    })
  );
}
