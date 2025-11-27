import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import { getBalancesReport, upsertDailyBalance } from "../services/balances.js";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  balance: z.number(),
  note: z.string().optional(),
});

export function registerBalanceRoutes(app: express.Express) {
  app.get(
    "/api/balances",
    authenticate,
    asyncHandler(async (req, res) => {
      const { from, to } = querySchema.parse(req.query);
      const report = await getBalancesReport(from, to);
      res.json(report);
    })
  );

  app.post(
    "/api/balances",
    authenticate,
    asyncHandler(async (req, res) => {
      const { date, balance, note } = bodySchema.parse(req.body);
      await upsertDailyBalance(date, balance, note);
      res.json({ status: "ok" });
    })
  );
}
