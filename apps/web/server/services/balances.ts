import dayjs from "dayjs";

import { prisma } from "../prisma.js";

export interface DailyBalanceRecord {
  date: string;
  totalIn: number;
  totalOut: number;
  netChange: number;
  expectedBalance: number;
  recordedBalance: number | null;
  difference: number | null;
  note: string | null;
  hasCashback: boolean;
}

export interface BalancesApiResponse {
  days: DailyBalanceRecord[];
  previous: {
    date: string;
    balance: number;
  } | null;
}

export async function getBalancesReport(from: string, to: string): Promise<BalancesApiResponse> {
  // 1. Get previous balance
  const previous = await prisma.dailyBalance.findFirst({
    where: {
      date: { lt: new Date(from) },
    },
    orderBy: { date: "desc" },
  });

  // 2. Get all transactions in range
  const transactions = await prisma.transaction.findMany({
    where: {
      transactionDate: {
        gte: new Date(from),
        lte: new Date(dayjs(to).endOf("day").toISOString()),
      },
    },
    select: {
      transactionDate: true,
      transactionAmount: true,
      transactionType: true,
    },
  });

  // 3. Get existing daily balances
  const existingBalances = await prisma.dailyBalance.findMany({
    where: {
      date: {
        gte: new Date(from),
        lte: new Date(to),
      },
    },
  });

  const balanceMap = new Map(existingBalances.map((b) => [dayjs(b.date).format("YYYY-MM-DD"), b]));

  // 4. Calculate daily stats
  const days: DailyBalanceRecord[] = [];
  let runningBalance = previous ? Number(previous.amount) : 0;

  let current = dayjs(from);
  const end = dayjs(to);

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const dateStr = current.format("YYYY-MM-DD");

    const dayTx = transactions.filter((t) => dayjs(t.transactionDate).format("YYYY-MM-DD") === dateStr);

    let totalIn = 0;
    let totalOut = 0;

    for (const tx of dayTx) {
      const amt = tx.transactionAmount.toNumber();
      if (amt >= 0) {
        totalIn += amt;
      } else {
        totalOut += Math.abs(amt);
      }
    }

    const netChange = totalIn - totalOut;
    const expectedBalance = runningBalance + netChange;

    const record = balanceMap.get(dateStr);
    const recordedBalance = record ? record.amount.toNumber() : null;
    const difference = recordedBalance !== null ? recordedBalance - expectedBalance : null;

    days.push({
      date: dateStr,
      totalIn,
      totalOut,
      netChange,
      expectedBalance,
      recordedBalance,
      difference,
      note: record?.note ?? null,
      hasCashback: false,
    });

    if (recordedBalance !== null) {
      runningBalance = recordedBalance;
    } else {
      runningBalance = expectedBalance;
    }

    current = current.add(1, "day");
  }

  return {
    days,
    previous: previous
      ? {
          date: dayjs(previous.date).format("YYYY-MM-DD"),
          balance: Number(previous.amount),
        }
      : null,
  };
}

export async function upsertDailyBalance(date: string, amount: number, note?: string) {
  return prisma.dailyBalance.upsert({
    where: { date: new Date(date) },
    update: {
      amount,
      note,
      updatedAt: new Date(),
    },
    create: {
      date: new Date(date),
      amount,
      note,
    },
  });
}
