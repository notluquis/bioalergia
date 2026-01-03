import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { getBalancesReport, upsertDailyBalance } from "../services/balances.js";
import { balanceUpsertSchema, balancesQuerySchema } from "../schemas/index.js";

export function registerBalanceRoutes(app: express.Express) {
  app.get(
    "/api/balances",
    authenticate,
    authorize("read", "DailyBalance"),
    asyncHandler(async (req, res) => {
      const { from, to } = balancesQuerySchema.parse(req.query);
      if (!from || !to) {
        // Fallback if schema allows optional but service requires them?
        // Logic: Schema says optional, but `getBalancesReport` signature: (from: string, to: string)
        // We need to ensure they are strings. Ideally schema should require them for this route,
        // OR we default them.
        throw new Error("Parameters 'from' and 'to' are required");
      }
      const report = await getBalancesReport(from, to);
      res.json(report);
    })
  );

  app.post(
    "/api/balances",
    authenticate,
    authorize("update", "DailyBalance"),
    asyncHandler(async (req, res) => {
      const { date, balance, note } = balanceUpsertSchema.parse(req.body);
      // Map 'balance' from schema to 'amount' in service if needed,
      // BUT `upsertDailyBalance` accepts (date, amount, note).
      // And we are passing `balance`. Wait.
      // Service arg name is `amount`. We can pass variable `balance` as 2nd arg.
      await upsertDailyBalance(date, balance, note);
      res.json({ status: "ok" });
    })
  );
}
