import { prisma } from "../prisma.js";
import { Prisma, TransactionDirection } from "../../generated/prisma/client.js";

export type TransactionFilters = {
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  direction?: "IN" | "OUT" | "NEUTRO";
  description?: string;
  origin?: string;
  destination?: string;
  sourceId?: string;
  bankAccountNumber?: string;
};

export async function listTransactions(filters: TransactionFilters, limit = 100, offset = 0) {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.from || filters.to) {
    where.timestamp = {};
    if (filters.from) where.timestamp.gte = filters.from;
    if (filters.to) where.timestamp.lte = filters.to;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
  }

  if (filters.direction) {
    where.direction = filters.direction;
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.origin) {
    where.origin = { contains: filters.origin, mode: "insensitive" };
  }

  if (filters.destination) {
    where.destination = { contains: filters.destination, mode: "insensitive" };
  }

  if (filters.sourceId) {
    where.sourceId = filters.sourceId;
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { origin: { contains: filters.search, mode: "insensitive" } },
      { destination: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        timestampRaw: true,
        timestamp: true,
        description: true,
        origin: true,
        destination: true,
        sourceId: true,
        direction: true,
        amount: true,
        sourceFile: true,
        createdAt: true,
        loanSchedules: {
          include: { loan: true },
        },
        serviceSchedules: {
          include: { service: true },
        },
      },
    }),
  ]);

  type TransactionWithRelations = {
    id: number;
    timestampRaw: string;
    timestamp: Date;
    description: string | null;
    origin: string | null;
    destination: string | null;
    sourceId: string | null;
    direction: TransactionDirection;
    amount: Prisma.Decimal;
    sourceFile: string | null;
    createdAt: Date;
    loanSchedules: { loan: Prisma.LoanGetPayload<{}> }[];
    serviceSchedules: { service: Prisma.ServiceGetPayload<{}> }[];
  };

  const typedTransactions = transactions as TransactionWithRelations[];

  // Manually fetch withdrawals for OUT transactions with sourceId
  // This mimics the LEFT JOIN mp_withdrawals
  const withdrawIds = typedTransactions
    .filter((t) => t.direction === "OUT" && t.sourceId)
    .map((t) => t.sourceId as string);

  let withdrawals: Record<string, Prisma.WithdrawalGetPayload<{}>> = {};
  if (withdrawIds.length > 0) {
    const wRows = await prisma.withdrawal.findMany({
      where: { withdrawId: { in: withdrawIds } },
    });
    withdrawals = wRows.reduce(
      (acc: Record<string, Prisma.WithdrawalGetPayload<{}>>, curr: Prisma.WithdrawalGetPayload<{}>) => {
        acc[curr.withdrawId] = curr;
        return acc;
      },
      {} as Record<string, Prisma.WithdrawalGetPayload<{}>>
    );
  }

  // Merge data
  const enriched = typedTransactions.map((t) => {
    const payout = (t.direction === "OUT" && t.sourceId && withdrawals[t.sourceId]) || null;
    return {
      ...t,
      payout,
      loanSchedule: t.loanSchedules[0] || null, // Assuming 1-1 for now based on legacy logic
      serviceSchedule: t.serviceSchedules[0] || null,
    };
  });

  return { total, transactions: enriched };
}

export async function getTransactionById(id: number) {
  return await prisma.transaction.findUnique({
    where: { id },
  });
}

export async function createTransaction(data: Prisma.TransactionCreateInput) {
  return await prisma.transaction.create({
    data,
  });
}

export async function createTransactionsBatch(data: Prisma.TransactionCreateManyInput[]) {
  return await prisma.transaction.createMany({
    data,
    skipDuplicates: true,
  });
}
