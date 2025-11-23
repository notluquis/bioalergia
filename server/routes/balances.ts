import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { listDailyBalances, getPreviousDailyBalance, upsertDailyBalance } from "../services/balances.js";
import { listTransactions } from "../services/transactions.js";
import { coerceDateOnly, formatDateOnly, iterateDateRange, normalizeDate, parseDateOnly } from "../lib/time.js";
import { addCurrency, roundCurrency } from "../../shared/currency.js";
import { isCashbackCandidate } from "../../shared/cashback.js";
import { balancesQuerySchema, balanceUpsertSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

export type DailyBalanceSummary = {
  date: string;
  totalIn: number;
  totalOut: number;
  netChange: number;
  expectedBalance: number | null;
  recordedBalance: number | null;
  difference: number | null;
  note: string | null;
  hasCashback: boolean;
};

export function registerBalanceRoutes(app: express.Express) {
  app.get(
    "/api/balances",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = balancesQuerySchema.parse(req.query);
      let fromDate = parsed.from ? coerceDateOnly(parsed.from) : null;
      let toDate = parsed.to ? coerceDateOnly(parsed.to) : null;

      const today = new Date();
      if (!toDate) {
        toDate = formatDateOnly(today);
      }
      const toDateObj = parseDateOnly(toDate);
      if (!toDateObj) {
        return res.status(400).json({ status: "error", message: "Fecha final inválida" });
      }

      if (!fromDate) {
        const defaultFrom = new Date(toDateObj);
        defaultFrom.setDate(defaultFrom.getDate() - 10);
        fromDate = formatDateOnly(defaultFrom);
      }
      const fromDateObj = parseDateOnly(fromDate);
      if (!fromDateObj) {
        return res.status(400).json({ status: "error", message: "Fecha inicial inválida" });
      }

      if (fromDateObj.getTime() > toDateObj.getTime()) {
        return res.status(400).json({ status: "error", message: "El rango de fechas es inválido" });
      }

      const fromStart = normalizeDate(fromDate, "start");
      const toEnd = normalizeDate(toDate, "end");
      if (!fromStart || !toEnd) {
        return res.status(400).json({ status: "error", message: "No se pudieron interpretar las fechas" });
      }

      const [balances, previous, transactions] = await Promise.all([
        listDailyBalances({ from: fromDate, to: toDate }),
        getPreviousDailyBalance(fromDate),
        listTransactions(
          {
            from: new Date(fromStart),
            to: new Date(toEnd),
          },
          10000
        ),
      ]);

      const changeByDate = new Map<
        string,
        { totalIn: number; totalOut: number; netChange: number; hasCashback: boolean }
      >();

      for (const tx of transactions.transactions) {
        const timestamp = tx.timestamp;
        const dateKey = timestamp.slice(0, 10);
        const amount = Number(tx.amount);
        const direction = tx.direction;

        let entry = changeByDate.get(dateKey);
        if (!entry) {
          entry = { totalIn: 0, totalOut: 0, netChange: 0, hasCashback: false };
          changeByDate.set(dateKey, entry);
        }

        if (!Number.isFinite(amount) || amount === 0) {
          continue;
        }

        if (
          isCashbackCandidate({
            direction,
            description: tx.description,
            origin: tx.origin,
            destination: tx.destination,
          })
        ) {
          entry.hasCashback = true;
          continue;
        }

        if (direction === "IN") {
          entry.totalIn = addCurrency(entry.totalIn, amount);
          entry.netChange = addCurrency(entry.netChange, amount);
        } else if (direction === "OUT") {
          entry.totalOut = addCurrency(entry.totalOut, amount);
          entry.netChange = addCurrency(entry.netChange, -amount);
        }
      }

      const balanceMap = new Map(balances.map((balance) => [balance.date, balance]));
      const summaries: DailyBalanceSummary[] = [];
      let runningBalance = previous ? Number(previous.balance) : null;

      for (const dateKey of iterateDateRange(fromDateObj, toDateObj)) {
        const entry = changeByDate.get(dateKey) ?? {
          totalIn: 0,
          totalOut: 0,
          netChange: 0,
          hasCashback: false,
        };
        const recorded = balanceMap.get(dateKey);
        const expected = runningBalance != null ? roundCurrency(runningBalance + entry.netChange) : null;
        const actual = recorded ? Number(recorded.balance) : null;
        const difference = actual != null && expected != null ? roundCurrency(actual - expected) : null;

        summaries.push({
          date: dateKey,
          totalIn: roundCurrency(entry.totalIn),
          totalOut: roundCurrency(entry.totalOut),
          netChange: roundCurrency(entry.netChange),
          expectedBalance: expected,
          recordedBalance: actual,
          difference,
          note: recorded?.note ?? null,
          hasCashback: entry.hasCashback,
        });

        if (actual != null) {
          runningBalance = actual;
        } else if (expected != null) {
          runningBalance = expected;
        }
      }

      logEvent(
        "balances/list",
        requestContext(req, {
          from: fromDate,
          to: toDate,
          days: summaries.length,
        })
      );

      res.json({
        status: "ok",
        from: fromDate,
        to: toDate,
        previous,
        days: summaries,
      });
    })
  );

  app.post(
    "/api/balances",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = balanceUpsertSchema.parse(req.body ?? {});
      const date = coerceDateOnly(parsed.date);
      if (!date) {
        return res.status(400).json({ status: "error", message: "La fecha no es válida" });
      }

      const balance = roundCurrency(parsed.balance);
      const note = parsed.note?.trim() ? parsed.note.trim() : null;

      await upsertDailyBalance({ date, balance, note });

      logEvent(
        "balances/upsert",
        requestContext(req, {
          date,
          balance,
          note,
        })
      );

      const [updated] = await listDailyBalances({ from: date, to: date });

      res.json({
        status: "ok",
        balance: updated ?? { date, balance, note },
      });
    })
  );
}
