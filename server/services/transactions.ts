import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

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
};

export type EnrichedTransaction = Prisma.TransactionGetPayload<{
  include: {
    person: true;
  };
}>;

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
      include: {
        person: true,
      },
    }),
  ]);

  return { total, transactions };
}

export async function getTransactionById(id: number) {
  return await prisma.transaction.findUnique({
    where: { id },
  });
}

export async function createTransaction(data: Prisma.TransactionUncheckedCreateInput) {
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
