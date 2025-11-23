import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import {
  createService,
  getServiceDetail,
  listServicesWithSummary,
  markServicePayment,
  regenerateServiceSchedule,
  unlinkServicePayment,
  updateService,
} from "../services/services.js";
import type { AuthenticatedRequest } from "../types.js";
import { serviceCreateSchema, servicePaymentSchema, serviceRegenerateSchema } from "../schemas.js";

function mapService(s: Prisma.ServiceGetPayload<{ include: { schedules: true } }>) {
  return {
    id: s.id,
    public_id: s.publicId,
    name: s.name,
    detail: s.detail,
    category: s.category,
    service_type: s.serviceType,
    ownership: s.ownership,
    obligation_type: s.obligationType,
    recurrence_type: s.recurrenceType,
    frequency: s.frequency,
    default_amount: s.defaultAmount,
    amount_indexation: s.amountIndexation,
    counterpart_id: s.counterpartId,
    counterpart_account_id: s.counterpartAccountId,
    account_reference: s.accountReference,
    emission_day: s.emissionDay,
    emission_mode: s.emissionMode,
    emission_start_day: s.emissionStartDay,
    emission_end_day: s.emissionEndDay,
    emission_exact_date: s.emissionExactDate,
    due_day: s.dueDay,
    start_date: s.startDate,
    next_generation_months: s.nextGenerationMonths,
    late_fee_mode: s.lateFeeMode,
    late_fee_value: s.lateFeeValue,
    late_fee_grace_days: s.lateFeeGraceDays,
    notes: s.notes,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    // Extra fields from summary/detail
    counterpart_name: s.counterpartName,
    counterpart_account_identifier: s.counterpartAccountIdentifier,
    counterpart_account_bank_name: s.counterpartAccountBankName,
    counterpart_account_type: s.counterpartAccountType,
    total_expected: s.total_expected,
    total_paid: s.total_paid,
    pending_count: s.pending_count,
    overdue_count: s.overdue_count,
  };
}

export function registerServiceRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/",
    authenticate,
    asyncHandler(async (_req: AuthenticatedRequest, res) => {
      const services = await listServicesWithSummary();
      res.json({
        status: "ok",
        services: services.map(
          (s: Prisma.ServiceGetPayload<{ include: { schedules: true } }> & { summary: unknown }) => ({
            ...mapService(s),
            summary: s.summary,
          })
        ),
      });
    })
  );

  router.post(
    "/",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = serviceCreateSchema.parse(req.body);
      logEvent("services:create", requestContext(req, parsed));
      const service = await createService({
        name: parsed.name,
        detail: parsed.detail ?? null,
        category: parsed.category ?? null,
        serviceType: parsed.serviceType,
        ownership: parsed.ownership,
        obligationType: parsed.obligationType,
        recurrenceType: parsed.recurrenceType,
        frequency: parsed.frequency,
        defaultAmount: parsed.defaultAmount,
        amountIndexation: parsed.amountIndexation,
        counterpartId: parsed.counterpartId ?? null,
        counterpartAccountId: parsed.counterpartAccountId ?? null,
        accountReference: parsed.accountReference ?? null,
        emissionDay: parsed.emissionDay ?? null,
        emissionMode: parsed.emissionMode,
        emissionStartDay: parsed.emissionStartDay ?? null,
        emissionEndDay: parsed.emissionEndDay ?? null,
        emissionExactDate: parsed.emissionExactDate ?? null,
        dueDay: parsed.dueDay ?? null,
        startDate: new Date(parsed.startDate),
        nextGenerationMonths: parsed.monthsToGenerate ?? 12,
        lateFeeMode: parsed.lateFeeMode,
        lateFeeValue: parsed.lateFeeValue ?? null,
        lateFeeGraceDays: parsed.lateFeeGraceDays ?? null,
        notes: parsed.notes ?? null,
      });

      await regenerateServiceSchedule(service.publicId, {
        months: parsed.monthsToGenerate ?? 12,
        startDate: parsed.startDate,
        defaultAmount: parsed.defaultAmount,
        dueDay: parsed.dueDay ?? null,
        frequency: parsed.frequency,
        emissionDay: parsed.emissionDay ?? null,
      });

      const detail = await getServiceDetail(service.publicId);
      // detail.service has summary merged
      res.json({
        status: "ok",
        service: detail ? mapService(detail.service) : mapService(service),
        schedules: detail?.schedules ?? [],
      });
    })
  );

  router.put(
    "/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = serviceCreateSchema.parse(req.body);
      logEvent("services:update", requestContext(req, { id, body: parsed }));
      const service = await updateService(id, parsed);
      const detail = await getServiceDetail(id);
      if (!detail) {
        return res.json({ status: "ok", service: mapService(service), schedules: [] });
      }
      res.json({
        status: "ok",
        service: mapService(detail.service),
        schedules: detail.schedules,
      });
    })
  );

  router.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const detail = await getServiceDetail(id);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "Servicio no encontrado" });
      }
      res.json({
        status: "ok",
        service: mapService(detail.service),
        schedules: detail.schedules,
      });
    })
  );

  router.post(
    "/:id/schedules",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const parsed = serviceRegenerateSchema.parse(req.body ?? {});
      logEvent("services:schedule:regenerate", requestContext(req, { id, overrides: parsed }));
      await regenerateServiceSchedule(id, {
        months: parsed.months,
        startDate: parsed.startDate,
        defaultAmount: parsed.defaultAmount,
        dueDay: parsed.dueDay,
        frequency: parsed.frequency,
        emissionDay: parsed.emissionDay ?? null,
      });
      const detail = await getServiceDetail(id);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "Servicio no encontrado" });
      }
      res.json({
        status: "ok",
        service: mapService(detail.service),
        schedules: detail.schedules,
      });
    })
  );

  router.post(
    "/schedules/:id/pay",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId)) {
        return res.status(400).json({ status: "error", message: "Identificador inválido" });
      }
      const parsed = servicePaymentSchema.parse(req.body);
      logEvent("services:schedule:pay", requestContext(req, { scheduleId, parsed }));
      const schedule = await markServicePayment({
        scheduleId,
        transactionId: parsed.transactionId,
        paidAmount: parsed.paidAmount,
        paidDate: parsed.paidDate,
        note: parsed.note ?? null,
      });
      res.json({ status: "ok", schedule });
    })
  );

  router.post(
    "/schedules/:id/unlink",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId)) {
        return res.status(400).json({ status: "error", message: "Identificador inválido" });
      }
      logWarn("services:schedule:unlink", requestContext(req, { scheduleId }));
      const schedule = await unlinkServicePayment(scheduleId);
      res.json({ status: "ok", schedule });
    })
  );

  app.use("/api/services", router);
}
