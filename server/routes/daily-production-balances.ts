import express from "express";
import dayjs from "dayjs";
import { asyncHandler, authenticate } from "../lib/http.js";
import type { AuthenticatedRequest } from "../types.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { productionBalancePayloadSchema, productionBalanceQuerySchema } from "../schemas.js";
import {
  createProductionBalance,
  getProductionBalanceById,
  listProductionBalances,
  updateProductionBalance,
  type ProductionBalancePayload,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductionBalance(p: any) {
  return {
    id: p.id,
    balance_date: p.balanceDate,
    ingreso_tarjetas: p.ingresoTarjetas,
    ingreso_transferencias: p.ingresoTransferencias,
    ingreso_efectivo: p.ingresoEfectivo,
    gastos_diarios: p.gastosDiarios,
    otros_abonos: p.otrosAbonos,
    consultas_monto: p.consultasMonto,
    controles_monto: p.controlesMonto,
    tests_monto: p.testsMonto,
    vacunas_monto: p.vacunasMonto,
    licencias_monto: p.licenciasMonto,
    roxair_monto: p.roxairMonto,
    comentarios: p.comentarios,
    status: p.status,
    change_reason: p.changeReason,
    created_by: p.createdBy,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json({ status: "ok", from: fromDate, to: toDate, items: items.map((i) => mapProductionBalance(i as any)) });
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json({ status: "ok", item: mapProductionBalance(created as any) });
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

      const updated = await updateProductionBalance(id, payload);

      logEvent("daily-production-balances/update", requestContext(req, { id, date: updated.balanceDate }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json({ status: "ok", item: mapProductionBalance(updated as any) });
    })
  );
}
