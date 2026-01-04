import { Hono } from "hono";
import dayjs from "dayjs";
import { getSessionUser } from "../auth";
import {
  createProductionBalance,
  getProductionBalanceById,
  listProductionBalances,
  updateProductionBalance,
} from "../services/daily-production-balances";
import {
  productionBalancePayloadSchema,
  productionBalanceQuerySchema,
} from "../lib/financial-schemas";

const app = new Hono();

// Helper to map record for response (mimicking legacy mapProductionBalance)
function mapResponse(p: any) {
  // Logic mostly in service via DB naming, but need to reconstruct some calculated fields if not in DB result
  // The service implementation returns DB objects.
  // We should apply transformation here if needed or modify service to do it.
  // For now, let's assume service returns raw objects and we format dates.
  // Actually, legacy service did mapping. My new service returns raw DB objects.
  // I need to replicate the calculation logic (subtotals) either here or in service.
  // Let's do it here for now to keep service simple CRUD.
  const subtotalIngresos =
    (p.ingresoTarjetas || 0) +
    (p.ingresoTransferencias || 0) +
    (p.ingresoEfectivo || 0);
  const totalIngresos = subtotalIngresos - (p.gastosDiarios || 0);
  const total = totalIngresos + (p.otrosAbonos || 0);

  return {
    id: p.id,
    date: dayjs(p.balanceDate).format("YYYY-MM-DD"),
    ingresoTarjetas: p.ingresoTarjetas,
    ingresoTransferencias: p.ingresoTransferencias,
    ingresoEfectivo: p.ingresoEfectivo,
    subtotalIngresos,
    gastosDiarios: p.gastosDiarios,
    totalIngresos,
    otrosAbonos: p.otrosAbonos,
    consultas: p.consultasMonto,
    controles: p.controlesMonto,
    tests: p.testsMonto,
    vacunas: p.vacunasMonto,
    licencias: p.licenciasMonto,
    roxair: p.roxairMonto,
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
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const query = c.req.query();
  const parsed = productionBalanceQuerySchema.safeParse(query);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Parámetros inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  const today = dayjs();
  const toDate = parsed.data.to ?? today.format("YYYY-MM-DD");
  const fromDate =
    parsed.data.from ?? today.subtract(30, "day").format("YYYY-MM-DD");

  const items = await listProductionBalances(fromDate, toDate);
  return c.json({
    status: "ok",
    from: fromDate,
    to: toDate,
    items: items.map(mapResponse),
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = productionBalancePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Payload inválido",
        issues: parsed.error.issues,
      },
      400
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
  return c.json({ status: "ok", item: mapResponse(created) });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = productionBalancePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Payload inválido",
        issues: parsed.error.issues,
      },
      400
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
  return c.json({ status: "ok", item: mapResponse(updated) });
});

export default app;
