import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { createLoan, getLoanById, listLoans, updateLoan, deleteLoan } from "../services/loans.js";
import { loanCreateSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerLoanRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const loans = await listLoans();
      res.json({ status: "ok", loans });
    })
  );

  router.post(
    "/",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = loanCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }
      logEvent("loans:create", requestContext(req, parsed.data));

      const loan = await createLoan({
        title: parsed.data.title,
        principalAmount: parsed.data.principalAmount,
        interestRate: parsed.data.interestRate,
        startDate: new Date(parsed.data.startDate),
        status: "ACTIVE",
      });

      res.json({
        status: "ok",
        loan,
      });
    })
  );

  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const loan = await getLoanById(id);
      if (!loan) {
        return res.status(404).json({ status: "error", message: "Préstamo no encontrado" });
      }
      res.json({ status: "ok", loan });
    })
  );

  router.put(
    "/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const parsed = loanCreateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      const loan = await updateLoan(id, {
        title: parsed.data.title,
        principalAmount: parsed.data.principalAmount,
        interestRate: parsed.data.interestRate,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      });

      res.json({ status: "ok", loan });
    })
  );

  router.delete(
    "/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      await deleteLoan(id);
      res.json({ status: "ok" });
    })
  );

  app.use("/api/loans", router);
}
