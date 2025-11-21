import express from "express";
import dayjs from "dayjs";
import { asyncHandler, authenticate } from "../lib/http.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { productionBalancePayloadSchema, productionBalanceQuerySchema } from "../schemas.js";
import {
  createProductionBalance,
  getProductionBalanceById,
  listProductionBalanceHistory,
  listProductionBalances,
  updateProductionBalance,
  type ProductionBalancePayload,
} from "../repositories/dailyProductionBalances.js";
import type { AuthenticatedRequest } from "../types.js";

function sanitizePayload(
  parsed: ReturnType<(typeof productionBalancePayloadSchema)["parse"]>
): ProductionBalancePayload {
  return {
    balanceDate: parsed.date,
    ingresoTarjetas: parsed.ingresoTarjetas,
    ingresoTransferencias: parsed.ingresoTransferencias,
    ingresoEfectivo: parsed.ingresoEfectivo,
    gastosDiarios: parsed.gastosDiarios,
    otrosAbonos: parsed.otrosAbonos,
    consultasCount: parsed.consultas,
    controlesCount: parsed.controles,
    testsCount: parsed.tests,
    vacunasCount: parsed.vacunas,
    licenciasCount: parsed.licencias,
    roxairCount: parsed.roxair,
    comentarios: parsed.comentarios ?? null,
    status: parsed.status ?? "DRAFT",
    changeReason: parsed.reason ?? null,
  };
}

export function registerDailyProductionBalanceRoutes(app: express.Express) {
  app.get(
    "/api/daily-production-balances",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = productionBalanceQuerySchema.parse(req.query ?? {});
      const today = dayjs();
      const toDate = parsed.to ?? today.format("YYYY-MM-DD");
      const fromDate = parsed.from ?? today.subtract(30, "day").format("YYYY-MM-DD");

      const items = await listProductionBalances({ from: fromDate, to: toDate });

      logEvent(
        "daily-production-balances/list",
        requestContext(req, {
          from: fromDate,
          to: toDate,
          count: items.length,
        })
      );

      res.json({ status: "ok", from: fromDate, to: toDate, items });
    })
  );

  app.post(
    "/api/daily-production-balances",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth?.userId) {
        return res.status(401).json({ status: "error", message: "No autorizado" });
      }
      const parsed = productionBalancePayloadSchema.parse(req.body ?? {});
      const payload = sanitizePayload(parsed);
      const created = await createProductionBalance(payload, req.auth.userId);

      logEvent("daily-production-balances/create", requestContext(req, { id: created.id, date: created.balanceDate }));

      res.json({ status: "ok", item: created });
    })
  );

  app.put(
    "/api/daily-production-balances/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth?.userId) {
        return res.status(401).json({ status: "error", message: "No autorizado" });
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const existing = await getProductionBalanceById(id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Registro no encontrado" });
      }
      const parsed = productionBalancePayloadSchema.parse(req.body ?? {});
      const payload = sanitizePayload(parsed);

      const updated = await updateProductionBalance(id, payload, req.auth.userId);

      logEvent("daily-production-balances/update", requestContext(req, { id, date: updated.balanceDate }));

      res.json({ status: "ok", item: updated });
    })
  );

  app.get(
    "/api/daily-production-balances/:id/history",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const existing = await getProductionBalanceById(id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Registro no encontrado" });
      }

      const entries = await listProductionBalanceHistory(id);
      res.json({ status: "ok", items: entries });
    })
  );
}
