import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
const parseDateOnly = (value: string) => dayjs.tz(value, "YYYY-MM-DD", TIMEZONE);

export interface DailyBalanceRecord {
  date: string; // YYYY-MM-DD
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
  const previous = await db.dailyBalance.findFirst({
    where: {
      date: { lt: parseDateOnly(from).startOf("day").toDate() },
    },
    orderBy: { date: "desc" },
  });

  const settlements = await db.settlementTransaction.findMany({
    where: {
      transactionDate: {
        gte: parseDateOnly(from).startOf("day").toDate(),
        lte: parseDateOnly(to).endOf("day").toDate(),
      },
    },
    select: {
      transactionDate: true,
      transactionAmount: true,
    },
  });

  const releases = await db.releaseTransaction.findMany({
    where: {
      date: {
        gte: parseDateOnly(from).startOf("day").toDate(),
        lte: parseDateOnly(to).endOf("day").toDate(),
      },
    },
    select: {
      date: true,
      grossAmount: true,
      netCreditAmount: true,
      netDebitAmount: true,
    },
  });

  const movements = [
    ...settlements.map((tx) => ({
      amount: Number(tx.transactionAmount),
      date: tx.transactionDate,
    })),
    ...releases.map((tx) => {
      const credit = Number(tx.netCreditAmount ?? 0);
      const debit = Number(tx.netDebitAmount ?? 0);
      const amount = credit !== 0 || debit !== 0 ? credit - debit : Number(tx.grossAmount ?? 0);
      return {
        amount,
        date: tx.date,
      };
    }),
  ];

  const existingBalances = await db.dailyBalance.findMany({
    where: {
      date: {
        gte: parseDateOnly(from).startOf("day").toDate(),
        lte: parseDateOnly(to).endOf("day").toDate(),
      },
    },
  });

  const balanceMap = new Map(
    existingBalances.map((b) => [dayjs(b.date).tz(TIMEZONE).format("YYYY-MM-DD"), b]),
  );

  const days: DailyBalanceRecord[] = [];
  let runningBalance = previous ? Number(previous.amount) : 0;

  let current = parseDateOnly(from);
  const end = parseDateOnly(to);

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const dateStr = current.format("YYYY-MM-DD");
    const dayTx = movements.filter((t) => dayjs(t.date).format("YYYY-MM-DD") === dateStr);

    let totalIn = 0;
    let totalOut = 0;

    for (const tx of dayTx) {
      const amt = Number(tx.amount);
      if (amt >= 0) {
        totalIn += amt;
      } else {
        totalOut += Math.abs(amt);
      }
    }

    const netChange = totalIn - totalOut;
    const expectedBalance = runningBalance + netChange;

    const record = balanceMap.get(dateStr);
    const recordedBalance = record ? Number(record.amount) : null;
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
          date: dayjs(previous.date).tz(TIMEZONE).format("YYYY-MM-DD"),
          balance: Number(previous.amount),
        }
      : null,
  };
}

import { Decimal } from "decimal.js";

export async function upsertDailyBalance(date: string, amount: number, note?: string) {
  const parsed = parseDateOnly(date).toDate();
  return db.dailyBalance.upsert({
    where: { date: parsed },
    update: {
      amount: new Decimal(amount),
      note,
      updatedAt: new Date(),
    },
    create: {
      date: parsed,
      amount: new Decimal(amount),
      note,
    },
  });
}
