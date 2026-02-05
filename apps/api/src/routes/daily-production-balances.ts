import type { DailyProductionBalance, User } from "@finanzas/db";
import dayjs from "dayjs";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  productionBalancePayloadSchema,
  productionBalanceQuerySchema,
} from "../lib/financial-schemas";
import {
  createProductionBalance,
  listProductionBalances,
  updateProductionBalance,
} from "../services/daily-production-balances";
import { reply } from "../utils/reply";

const app = new Hono();

// Type for production balance response mapper - includes optional user relation
type ProductionBalanceWithUser = DailyProductionBalance & {
  user?: Pick<User, "email"> | null;
};

// Helper to map record for response (mimicking legacy mapProductionBalance)
function mapResponse(p: ProductionBalanceWithUser) {
  // Logic mostly in service via DB naming, but need to reconstruct some calculated fields if not in DB result
  // The service implementation returns DB objects.
  // We should apply transformation here if needed or modify service to do it.
  // For now, let's assume service returns raw objects and we format dates.
  // Actually, legacy service did mapping. My new service returns raw DB objects.
  // I need to replicate the calculation logic (subtotals) either here or in service.
  // Let's do it here for now to keep service simple CRUD.
  const subtotalIngresos =
    (p.ingresoTarjetas || 0) + (p.ingresoTransferencias || 0) + (p.ingresoEfectivo || 0);
  const totalIngresos = subtotalIngresos - (p.gastosDiarios || 0);
  const total = totalIngresos + (p.otrosAbonos || 0);

  return {
    id: p.id,
    date: p.balanceDate,
    ingresoTarjetas: p.ingresoTarjetas,
    ingresoTransferencias: p.ingresoTransferencias,
    ingresoEfectivo: p.ingresoEfectivo,
    subtotalIngresos,
    gastosDiarios: p.gastosDiarios,
    totalIngresos,
    otrosAbonos: p.otrosAbonos,
    consultasMonto: p.consultasMonto,
    controlesMonto: p.controlesMonto,
    testsMonto: p.testsMonto,
    vacunasMonto: p.vacunasMonto,
    licenciasMonto: p.licenciasMonto,
    roxairMonto: p.roxairMonto,
    total,
    comentarios: p.comentarios,
    status: p.status,
    changeReason: p.changeReason,
    createdByEmail: p.user?.email ?? null,
    updatedByEmail: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "ProductionBalance");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const query = c.req.query();
  const parsed = productionBalanceQuerySchema.safeParse(query);

  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Parámetros inválidos",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const today = dayjs();
  const toDateStr = parsed.data.to ?? today.format("YYYY-MM-DD");
  const fromDateStr = parsed.data.from ?? today.subtract(30, "day").format("YYYY-MM-DD");

  const items = await listProductionBalances(fromDateStr, toDateStr);
  return reply(c, {
    status: "ok",
    from: dayjs(fromDateStr).toDate(),
    to: dayjs(toDateStr).toDate(),
    items: items.map(mapResponse),
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "ProductionBalance");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = productionBalancePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Payload inválido",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  // Map schema 'date' to 'balanceDate'
  const payload = {
    ...parsed.data,
    balanceDate: parsed.data.date,
    consultasMonto: parsed.data.consultas,
    controlesMonto: parsed.data.controles,
    testsMonto: parsed.data.tests,
    vacunasMonto: parsed.data.vacunas,
    licenciasMonto: parsed.data.licencias,
    roxairMonto: parsed.data.roxair,
  };

  const created = await createProductionBalance(payload, user.id);
  return reply(c, { status: "ok", item: mapResponse(created) });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "ProductionBalance");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = productionBalancePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Payload inválido",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const payload = {
    ...parsed.data,
    balanceDate: parsed.data.date,
    consultasMonto: parsed.data.consultas,
    controlesMonto: parsed.data.controles,
    testsMonto: parsed.data.tests,
    vacunasMonto: parsed.data.vacunas,
    licenciasMonto: parsed.data.licencias,
    roxairMonto: parsed.data.roxair,
  };

  const updated = await updateProductionBalance(id, payload);
  return reply(c, { status: "ok", item: mapResponse(updated) });
});

export default app;
