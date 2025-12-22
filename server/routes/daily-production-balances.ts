import express from "express";
import dayjs from "dayjs";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import type { AuthenticatedRequest } from "../types.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { productionBalancePayloadSchema, productionBalanceQuerySchema } from "../schemas/index.js";
import {
  createProductionBalance,
  getProductionBalanceById,
  listProductionBalances,
  updateProductionBalance,
  type ProductionBalancePayload,
  type ProductionBalanceRecord,
} from "../services/daily-production-balances.js";

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
    consultasMonto: parsed.consultas,
    controlesMonto: parsed.controles,
    testsMonto: parsed.tests,
    vacunasMonto: parsed.vacunas,
    licenciasMonto: parsed.licencias,
    roxairMonto: parsed.roxair,
    comentarios: parsed.comentarios ?? null,
    status: parsed.status ?? "DRAFT",
    changeReason: parsed.reason ?? null,
  };
}

function mapProductionBalance(p: ProductionBalanceRecord) {
  return {
    id: p.id,
    date: p.balanceDate,
    ingresoTarjetas: p.ingresoTarjetas,
    ingresoTransferencias: p.ingresoTransferencias,
    ingresoEfectivo: p.ingresoEfectivo,
    subtotalIngresos: p.subtotalIngresos,
    gastosDiarios: p.gastosDiarios,
    totalIngresos: p.totalIngresos,
    otrosAbonos: p.otrosAbonos,
    consultas: p.consultasMonto,
    controles: p.controlesMonto,
    tests: p.testsMonto,
    vacunas: p.vacunasMonto,
    licencias: p.licenciasMonto,
    roxair: p.roxairMonto,
    total: p.total,
    comentarios: p.comentarios,
    status: p.status,
    changeReason: p.changeReason,
    createdByEmail: p.createdByEmail ?? null,
    updatedByEmail: p.updatedByEmail ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function registerDailyProductionBalanceRoutes(app: express.Express) {
  app.get(
    "/api/daily-production-balances",
    authenticate,
    authorize("read", "ProductionBalance"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const normalize = (value: unknown): string | undefined => {
        if (Array.isArray(value)) return value[0];
        return typeof value === "string" ? value : undefined;
      };

      const raw = { from: normalize(req.query?.from), to: normalize(req.query?.to) };
      const parsedResult = productionBalanceQuerySchema.safeParse(raw);
      if (!parsedResult.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Parámetros inválidos", issues: parsedResult.error.issues });
      }

      const today = dayjs();
      const toDate = parsedResult.data.to ?? today.format("YYYY-MM-DD");
      const fromDate = parsedResult.data.from ?? today.subtract(30, "day").format("YYYY-MM-DD");

      const items = await listProductionBalances({ from: fromDate, to: toDate });

      logEvent(
        "daily-production-balances/list",
        requestContext(req, {
          from: fromDate,
          to: toDate,
          count: items.length,
        })
      );

      res.json({ status: "ok", from: fromDate, to: toDate, items: items.map(mapProductionBalance) });
    })
  );

  app.post(
    "/api/daily-production-balances",
    authenticate,
    authorize("create", "ProductionBalance"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth?.userId) {
        return res.status(401).json({ status: "error", message: "No autorizado" });
      }
      const parsedResult = productionBalancePayloadSchema.safeParse(req.body ?? {});
      if (!parsedResult.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Payload inválido", issues: parsedResult.error.issues });
      }
      const parsed = parsedResult.data;
      const payload = sanitizePayload(parsed);
      const created = await createProductionBalance(payload, req.auth.userId);

      logEvent("daily-production-balances/create", requestContext(req, { id: created.id, date: created.balanceDate }));

      res.json({ status: "ok", item: mapProductionBalance(created) });
    })
  );

  app.put(
    "/api/daily-production-balances/:id",
    authenticate,
    authorize("update", "ProductionBalance"),
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
      const parsedResult = productionBalancePayloadSchema.safeParse(req.body ?? {});
      if (!parsedResult.success) {
        return res
          .status(400)
          .json({ status: "error", message: "Payload inválido", issues: parsedResult.error.issues });
      }
      const parsed = parsedResult.data;
      const payload = sanitizePayload(parsed);

      const updated = await updateProductionBalance(id, payload);

      logEvent("daily-production-balances/update", requestContext(req, { id, date: updated.balanceDate }));

      res.json({ status: "ok", item: mapProductionBalance(updated) });
    })
  );
}
