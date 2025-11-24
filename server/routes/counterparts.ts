import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/index.js";
import { requestContext, logEvent } from "../lib/logger.js";
import {
  listCounterparts,
  getCounterpartById,
  createCounterpart,
  updateCounterpart,
  upsertCounterpartAccount,
  updateCounterpartAccount,
  listAccountSuggestions,
  counterpartSummary,
  assignAccountsToCounterpartByRut,
} from "../services/counterparts.js";
import { Prisma, CounterpartPersonType, CounterpartCategory } from "../../generated/prisma/client.js";

type CounterpartWithAccounts = Prisma.CounterpartGetPayload<{
  include: { accounts: true };
}>;

type CounterpartAccountType = Prisma.CounterpartAccountGetPayload<{}>;

import {
  counterpartPayloadSchema,
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
  statsQuerySchema,
} from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

function mapCounterpart(c: CounterpartWithAccounts) {
  return {
    id: c.id,
    rut: c.rut,
    name: c.name,
    person_type: c.personType,
    category: c.category,
    email: c.email,
    employee_id: c.employeeId,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function mapCounterpartAccount(a: CounterpartAccountType) {
  return {
    id: a.id,
    counterpart_id: a.counterpartId,
    account_identifier: a.accountIdentifier,
    bank_name: a.bankName,
    account_type: a.accountType,
    holder: a.holder,
    concept: a.concept,
    metadata: a.metadata,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export function registerCounterpartRoutes(app: express.Express) {
  app.get(
    "/api/counterparts",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent("counterparts:list", requestContext(req));
      const counterparts = await listCounterparts();
      res.json({
        status: "ok",
        counterparts: counterparts.map((c: CounterpartWithAccounts) => ({
          ...mapCounterpart(c),
          accounts: c.accounts ? c.accounts.map(mapCounterpartAccount) : [],
        })),
      });
    })
  );

  app.post(
    "/api/counterparts",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = counterpartPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }
      const payload = parsed.data;
      const counterpart = await createCounterpart({
        rut: payload.rut,
        name: payload.name,
        personType: (payload.personType ?? "OTHER") as CounterpartPersonType,
        category: (payload.category ?? "SUPPLIER") as CounterpartCategory,
        email: payload.email ?? null,
        employeeId: payload.employeeId ?? null,
        notes: payload.notes ?? null,
      });
      const id = counterpart.id;
      const detail = await getCounterpartById(id);
      logEvent("counterparts:create", requestContext(req, { id }));
      res.status(201).json({
        status: "ok",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        counterpart: detail ? mapCounterpart(detail.counterpart as any) : mapCounterpart(counterpart as any),
        accounts: detail?.accounts ? detail.accounts.map(mapCounterpartAccount) : [],
      });
    })
  );

  app.put(
    "/api/counterparts/:id",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const counterpartId = Number(req.params.id);
      if (!Number.isFinite(counterpartId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const parsed = counterpartPayloadSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }
      await updateCounterpart(counterpartId, {
        rut: parsed.data.rut,
        name: parsed.data.name,
        personType: parsed.data.personType as CounterpartPersonType,
        category: parsed.data.category as CounterpartCategory,
        email: parsed.data.email,
        employeeId: parsed.data.employeeId ?? null,
        notes: parsed.data.notes,
      });
      const detail = await getCounterpartById(counterpartId);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "No se ha encontrado la contraparte" });
      }
      logEvent("counterparts:update", requestContext(req, { id: counterpartId }));
      res.json({
        status: "ok",
        counterpart: mapCounterpart(detail.counterpart),
        accounts: detail.accounts.map(mapCounterpartAccount),
      });
    })
  );

  app.get(
    "/api/counterparts/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const counterpartId = Number(req.params.id);
      if (!Number.isFinite(counterpartId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const detail = await getCounterpartById(counterpartId);
      if (!detail) {
        return res.status(404).json({ status: "error", message: "No se ha encontrado la contraparte" });
      }
      res.json({
        status: "ok",
        counterpart: mapCounterpart(detail.counterpart),
        accounts: detail.accounts.map(mapCounterpartAccount),
      });
    })
  );

  app.post(
    "/api/counterparts/:id/accounts",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const counterpartId = Number(req.params.id);
      if (!Number.isFinite(counterpartId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const parsed = counterpartAccountPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }
      const accountId = await upsertCounterpartAccount(counterpartId, {
        ...parsed.data,
        metadata: (parsed.data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      });
      const detail = await getCounterpartById(counterpartId);
      logEvent("counterparts:account:upsert", requestContext(req, { counterpartId, accountId }));
      res.status(201).json({
        status: "ok",
        accounts: detail?.accounts ? detail.accounts.map(mapCounterpartAccount) : [],
      });
    })
  );

  app.post(
    "/api/counterparts/:id/attach-rut",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const counterpartId = Number(req.params.id);
      if (!Number.isFinite(counterpartId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const rut = typeof req.body?.rut === "string" ? req.body.rut : "";
      if (!rut.trim()) {
        return res.status(400).json({ status: "error", message: "El RUT es obligatorio" });
      }
      await assignAccountsToCounterpartByRut(counterpartId, rut);
      const detail = await getCounterpartById(counterpartId);
      res.json({
        status: "ok",
        accounts: detail?.accounts ? detail.accounts.map(mapCounterpartAccount) : [],
      });
    })
  );

  app.put(
    "/api/counterparts/accounts/:accountId",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const accountId = Number(req.params.accountId);
      if (!Number.isFinite(accountId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const parsed = counterpartAccountUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }
      await updateCounterpartAccount(accountId, {
        ...parsed.data,
        metadata: (parsed.data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      });
      res.json({ status: "ok" });
    })
  );

  app.get(
    "/api/counterparts/suggestions",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));
      const suggestions = await listAccountSuggestions(query, limit);
      res.json({ status: "ok", suggestions });
    })
  );

  app.get(
    "/api/counterparts/:id/summary",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const counterpartId = Number(req.params.id);
      if (!Number.isFinite(counterpartId)) {
        return res.status(400).json({ status: "error", message: "El ID no es válido" });
      }
      const parsed = statsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Parámetros inválidos", issues: parsed.error.issues });
      }
      const summary = await counterpartSummary(counterpartId, parsed.data);
      res.json({ status: "ok", summary });
    })
  );
}
