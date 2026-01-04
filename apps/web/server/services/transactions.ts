import { accessibleBy } from "@casl/prisma";
import { Prisma } from "@prisma/client";

import type { AppAbility } from "../lib/authz/ability.js";
import { prisma } from "../prisma.js";

export type TransactionFilters = {
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  status?: string;
  transactionType?: string;
  description?: string;
  externalReference?: string;
  sourceId?: string;
};

export async function listTransactions(filters: TransactionFilters, limit = 100, offset = 0, ability?: AppAbility) {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.from || filters.to) {
    where.transactionDate = {};
    if (filters.from) where.transactionDate.gte = filters.from;
    if (filters.to) where.transactionDate.lte = filters.to;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.transactionAmount = {};
    if (filters.minAmount !== undefined) where.transactionAmount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.transactionAmount.lte = filters.maxAmount;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.transactionType) {
    where.transactionType = filters.transactionType;
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.externalReference) {
    where.externalReference = { contains: filters.externalReference, mode: "insensitive" };
  }

  if (filters.sourceId) {
    where.sourceId = { contains: filters.sourceId, mode: "insensitive" };
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { externalReference: { contains: filters.search, mode: "insensitive" } },
      { paymentMethod: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // ABAC: Apply accessibleBy filter if ability is provided
  if (ability) {
    const accessQuery = accessibleBy(ability).Transaction;
    where.AND = [accessQuery];
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: limit,
      skip: offset,
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
