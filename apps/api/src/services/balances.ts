import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";
import {
  dbDateToISO,
  instantToChileDate,
  isoToDbDate,
  iterateDateRange,
  parseChileDateOnly,
} from "../lib/time.ts";

// Chile-day bounds as UTC instants for range queries on instant columns.
const chileDayStart = (value: string) => parseChileDateOnly(value) ?? new Date(NaN);
const chileDayEnd = (value: string) => {
  const start = parseChileDateOnly(value);
  return start ? new Date(start.getTime() + 86_400_000 - 1) : new Date(NaN);
};

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
      date: { lt: chileDayStart(from) },
    },
    orderBy: { date: "desc" },
  });

  const settlements = await db.settlementTransaction.findMany({
    where: {
      transactionDate: {
        gte: chileDayStart(from),
        lte: chileDayEnd(to),
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
        gte: chileDayStart(from),
        lte: chileDayEnd(to),
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
        gte: chileDayStart(from),
        lte: chileDayEnd(to),
      },
    },
  });

  // b.date is @db.Date (UTC-anchored) -> dbDateToISO; dayjs(x).tz() would roll
  // the day back under Santiago (the off-by-one bug class).
  const balanceMap = new Map(existingBalances.map((b) => [dbDateToISO(b.date) ?? "", b]));

  const days: DailyBalanceRecord[] = [];
  let runningBalance = previous ? Number(previous.amount) : 0;

  for (const dateStr of iterateDateRange(chileDayStart(from), chileDayStart(to))) {
    // t.date is a real instant (transactionDate / release date) -> local date.
    const dayTx = movements.filter((t) => instantToChileDate(t.date) === dateStr);

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
  }

  return {
    days,
    previous: previous
      ? {
          // @db.Date -> dbDateToISO (UTC, no rollback).
          date: dbDateToISO(previous.date) ?? "",
          balance: Number(previous.amount),
        }
      : null,
  };
}

export async function upsertDailyBalance(date: string, amount: number, note?: string) {
  // @db.Date write -> UTC-midnight anchor (canonical).
  const parsed = isoToDbDate(date);
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
