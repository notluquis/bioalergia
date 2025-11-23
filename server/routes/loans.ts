import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import {
  createLoan,
  getLoanDetail,
  listLoansWithSummary,
  markLoanSchedulePayment,
  regenerateLoanSchedule,
  unlinkLoanSchedulePayment,
} from "../services/loans.js";
import { loanCreateSchema, loanPaymentSchema, loanScheduleRegenerateSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerLoanRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const loans = await listLoansWithSummary();
      res.json({ status: "ok", loans });
    })
  );

  router.post(
    "/",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = loanCreateSchema.parse(req.body);
      logEvent("loans:create", requestContext(req, parsed));

      const loan = await createLoan({
        title: parsed.title,
        borrowerName: parsed.borrowerName,
        borrowerType: parsed.borrowerType,
        principalAmount: parsed.principalAmount,
        interestRate: parsed.interestRate,
        interestType: parsed.interestType ?? "SIMPLE",
        frequency: parsed.frequency,
        totalInstallments: parsed.totalInstallments,
        startDate: parsed.startDate,
        notes: parsed.notes ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      if (parsed.generateSchedule) {
        await regenerateLoanSchedule(loan.publicId, {
          totalInstallments: parsed.totalInstallments,
          startDate: parsed.startDate,
          interestRate: parsed.interestRate,
          frequency: parsed.frequency,
        });
      }

      const detail = await getLoanDetail(loan.publicId);
      res.json({
        status: "ok",
        loan: detail?.loan ?? loan,
        schedules: detail?.schedules ?? [],
        summary: detail?.summary,
      });
    })
  );

  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const detail = await getLoanDetail(id);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "Préstamo no encontrado" });
      }
      res.json({ status: "ok", ...detail });
    })
  );

  router.post(
    "/:id/schedules",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = loanScheduleRegenerateSchema.parse(req.body ?? {});
      logEvent("loans:schedule:regenerate", requestContext(req, { id, overrides: parsed }));
      await regenerateLoanSchedule(id, parsed);
      const detail = await getLoanDetail(id);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "Préstamo no encontrado" });
      }
      res.json({ status: "ok", ...detail });
    })
  );

  app.post(
    "/api/loan-schedules/:id/pay",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId)) {
        return res.status(400).json({ status: "error", message: "Identificador inválido" });
      }
      const parsed = loanPaymentSchema.parse(req.body);
      logEvent("loans:schedule:pay", requestContext(req, { scheduleId, parsed }));
      const schedule = await markLoanSchedulePayment({
        scheduleId,
        transactionId: parsed.transactionId,
        paidAmount: parsed.paidAmount,
        paidDate: parsed.paidDate,
      });
      res.json({ status: "ok", schedule });
    })
  );

  app.post(
    "/api/loan-schedules/:id/unlink",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId)) {
        return res.status(400).json({ status: "error", message: "Identificador inválido" });
      }
      logWarn("loans:schedule:unlink", requestContext(req, { scheduleId }));
      const schedule = await unlinkLoanSchedulePayment(scheduleId);
      res.json({ status: "ok", schedule });
    })
  );

  app.use("/api/loans", router);
}
