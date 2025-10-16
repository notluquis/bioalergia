import express from "express";
import { authenticate, asyncHandler, requireRole } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import type { AuthenticatedRequest } from "../types.js";
import {
  createMonthlyExpense,
  getMonthlyExpenseDetail,
  getMonthlyExpenseStats,
  linkMonthlyExpenseTransaction,
  listMonthlyExpenses,
  unlinkMonthlyExpenseTransaction,
  updateMonthlyExpense,
} from "../db.js";
import { monthlyExpenseSchema, monthlyExpenseLinkSchema, monthlyExpenseStatsSchema } from "../schemas.js";

export function registerMonthlyExpenseRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { from, to, status, serviceId } = req.query;
      const filters = {
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
        status:
          typeof status === "string" && status.length
            ? (status.split(",") as ("OPEN" | "CLOSED")[])
            : undefined,
        serviceId:
          typeof serviceId === "string" && serviceId.length
            ? Number(serviceId)
            : undefined,
      };
      const expenses = await listMonthlyExpenses(filters);
      res.json({ status: "ok", expenses });
    })
  );

  router.get(
    "/stats",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = monthlyExpenseStatsSchema.parse(req.query);
      const stats = await getMonthlyExpenseStats(parsed);
      res.json({ status: "ok", stats });
    })
  );

  router.post(
    "/",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = monthlyExpenseSchema.parse(req.body);
      logEvent("expenses:create", requestContext(req, parsed));
      const expense = await createMonthlyExpense({
        name: parsed.name,
        category: parsed.category ?? null,
        amountExpected: parsed.amountExpected,
        expenseDate: parsed.expenseDate,
        notes: parsed.notes ?? null,
        source: parsed.source,
        serviceId: parsed.serviceId ?? null,
        tags: parsed.tags ?? [],
        status: parsed.status ?? "OPEN",
      });
      res.json({ status: "ok", expense });
    })
  );

  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const detail = await getMonthlyExpenseDetail(id);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "Gasto no encontrado" });
      }
      res.json({ status: "ok", expense: detail });
    })
  );

  router.put(
    "/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = monthlyExpenseSchema.parse(req.body);
      logEvent("expenses:update", requestContext(req, { id, body: parsed }));
      const expense = await updateMonthlyExpense(id, {
        name: parsed.name,
        category: parsed.category ?? null,
        amountExpected: parsed.amountExpected,
        expenseDate: parsed.expenseDate,
        notes: parsed.notes ?? null,
        source: parsed.source,
        serviceId: parsed.serviceId ?? null,
        tags: parsed.tags ?? [],
        status: parsed.status ?? "OPEN",
      });
      res.json({ status: "ok", expense });
    })
  );

  router.post(
    "/:id/link",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = monthlyExpenseLinkSchema.parse(req.body);
      logEvent("expenses:link", requestContext(req, { id, payload: parsed }));
      const expense = await linkMonthlyExpenseTransaction(id, parsed);
      res.json({ status: "ok", expense });
    })
  );

  router.post(
    "/:id/unlink",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = monthlyExpenseLinkSchema.parse(req.body);
      logWarn("expenses:unlink", requestContext(req, { id, payload: parsed }));
      const expense = await unlinkMonthlyExpenseTransaction(id, parsed.transactionId);
      res.json({ status: "ok", expense });
    })
  );

  app.use("/api/expenses", router);
}
