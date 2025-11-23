import { prisma } from "../prisma.js";
import { formatDateOnly } from "../lib/time.js";

type DailyBalance = {
  date: string;
  balance: number;
  note: string | null;
};

export async function listDailyBalances(options: { from?: string; to?: string }): Promise<DailyBalance[]> {
  const where: { balanceDate?: { gte?: Date; lte?: Date } } = {};

  if (options.from) {
    where.balanceDate = { ...where.balanceDate, gte: new Date(options.from) };
  }

  if (options.to) {
    where.balanceDate = { ...where.balanceDate, lte: new Date(options.to) };
  }

  const balances = await prisma.dailyBalance.findMany({
    where,
    orderBy: { balanceDate: "asc" },
  });

  return balances.map((row: { balanceDate: Date; balance: number; note: string | null }) => ({
    date: formatDateOnly(row.balanceDate),
    balance: Number(row.balance),
    note: row.note,
  }));
}

export async function getPreviousDailyBalance(date: string): Promise<DailyBalance | null> {
  const balance = await prisma.dailyBalance.findFirst({
    where: {
      balanceDate: { lt: new Date(date) },
    },
    orderBy: { balanceDate: "desc" },
  });

  if (!balance) return null;

  return {
    date: formatDateOnly(balance.balanceDate),
    balance: Number(balance.balance),
    note: balance.note,
  };
}

export async function upsertDailyBalance(entry: { date: string; balance: number; note?: string | null }) {
  await prisma.dailyBalance.upsert({
    where: { balanceDate: new Date(entry.date) },
    create: {
      balanceDate: new Date(entry.date),
      balance: entry.balance,
      note: entry.note ?? null,
    },
    update: {
      balance: entry.balance,
      note: entry.note ?? null,
    },
  });
}
