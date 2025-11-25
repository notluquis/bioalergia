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
} from "../services/counterparts.js";
import { PersonType, CounterpartCategory } from "../../generated/prisma/client.js";

import {
  counterpartPayloadSchema,
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
} from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

import { mapCounterpart, mapCounterpartAccount, type CounterpartWithAccounts } from "../lib/mappers.js";

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
      if (!payload.rut) {
        return res.status(400).json({ status: "error", message: "El RUT es obligatorio" });
      }
      const counterpart = await createCounterpart({
        rut: payload.rut,
        name: payload.name,
        personType: (payload.personType ?? "NATURAL") as PersonType,
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
        rut: parsed.data.rut ?? undefined,
        name: parsed.data.name,
        personType: parsed.data.personType as PersonType | undefined,
        category: parsed.data.category as CounterpartCategory | undefined,
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
        accountNumber: parsed.data.accountIdentifier,
        bankName: parsed.data.bankName,
        accountType: parsed.data.accountType,
      });
      const detail = await getCounterpartById(counterpartId);
      logEvent("counterparts:account:upsert", requestContext(req, { counterpartId, accountId }));

      res.status(201).json({
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
      });
      res.json({ status: "ok" });
    })
  );
}
