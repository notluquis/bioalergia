import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  productionBalanceItemResponseSchema,
  productionBalancePayloadSchema,
  productionBalancesListResponseSchema,
  productionBalanceQuerySchema,
  productionBalanceUpdateSchema,
} from "@finanzas/orpc-contracts/production-balances";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { dbDateToISO, toChileDateString } from "../lib/time.ts";
import {
  createProductionBalance,
  listProductionBalances,
  updateProductionBalance,
} from "../services/daily-production-balances.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ProductionBalancesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ProductionBalancesORPCContext>();

// `balanceDate` is a `@db.Date` column → the pg driver returns a JS Date
// (no type parser registered for OID 1082). The oRPC output contract field
// `date` is `z.string()` (YYYY-MM-DD wire format, symmetric with the input).
// The previous version annotated `balanceDate: string` and forced the cast
// `as unknown as ProductionBalanceWithUser`, which masked the type mismatch
// — handler returned a Date, oRPC `.output()` validation threw "Output
// validation failed" (500), but the row was already inserted, so the next
// save attempt produced a `daily_production_balances_balance_date_key`
// 23505 duplicate. Source of truth is the service return; format here.
type ProductionBalanceRow = {
  balanceDate: Date;
  changeReason: null | string;
  comentarios: null | string;
  consultasMonto: number;
  controlesMonto: number;
  createdAt: Date;
  gastosDiarios: number;
  id: number;
  ingresoEfectivo: number;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  licenciasMonto: number;
  otrosAbonos: number;
  roxairMonto: number;
  status: string;
  testsMonto: number;
  updatedAt: Date;
  user?: { person?: { email?: null | string } } | null;
  vacunasMonto: number;
};

export function mapProductionBalanceResponse(p: ProductionBalanceRow) {
  const subtotalIngresos =
    (p.ingresoTarjetas || 0) + (p.ingresoTransferencias || 0) + (p.ingresoEfectivo || 0);
  const totalIngresos = subtotalIngresos - (p.gastosDiarios || 0);
  const total = totalIngresos + (p.otrosAbonos || 0);

  return {
    id: p.id,
    // balanceDate is @db.Date (UTC-midnight) -> "YYYY-MM-DD" via canonical helper.
    date: dbDateToISO(p.balanceDate) ?? "",
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
    createdByEmail: p.user?.person?.email ?? null,
    updatedByEmail: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readBalances = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "ProductionBalance");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeBalances = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "ProductionBalance");
  const canUpdate = await hasPermission(context.user, "update", "ProductionBalance");

  if (!canCreate && !canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const productionBalancesORPCRouterBase = {
  create: writeBalances
    .route({
      method: "POST",
      path: "/",
      summary: "Create a production balance",
      tags: ["Production Balances"],
    })
    .input(productionBalancePayloadSchema)
    .output(productionBalanceItemResponseSchema)
    .handler(async ({ context, input }) => {
      const created = await createProductionBalance(
        {
          balanceDate: input.date,
          ingresoTarjetas: input.ingresoTarjetas,
          ingresoTransferencias: input.ingresoTransferencias,
          ingresoEfectivo: input.ingresoEfectivo,
          gastosDiarios: input.gastosDiarios,
          otrosAbonos: input.otrosAbonos,
          comentarios: input.comentarios ?? null,
          status: input.status,
          changeReason: input.reason ?? null,
          consultasMonto: input.consultas,
          controlesMonto: input.controles,
          testsMonto: input.tests,
          vacunasMonto: input.vacunas,
          licenciasMonto: input.licencias,
          roxairMonto: input.roxair,
        },
        context.user.id
      );

      return {
        item: mapProductionBalanceResponse(created),
        status: "ok" as const,
      };
    }),

  list: readBalances
    .route({
      method: "GET",
      path: "/",
      summary: "List production balances",
      tags: ["Production Balances"],
    })
    .input(productionBalanceQuerySchema)
    .output(productionBalancesListResponseSchema)
    .handler(async ({ input }) => {
      const toDateStr = input.to ?? toChileDateString(new Date());
      const fromDateStr = input.from ?? toChileDateString(new Date(Date.now() - 30 * 86_400_000));
      const items = await listProductionBalances(fromDateStr, toDateStr);

      return {
        status: "ok" as const,
        from: fromDateStr,
        to: toDateStr,
        items: items.map((item) => mapProductionBalanceResponse(item)),
      };
    }),

  update: writeBalances
    .route({
      method: "PUT",
      path: "/{id}",
      summary: "Update a production balance",
      tags: ["Production Balances"],
    })
    .input(productionBalanceUpdateSchema)
    .output(productionBalanceItemResponseSchema)
    .handler(async ({ input }) => {
      const updated = await updateProductionBalance(input.id, {
        balanceDate: input.date,
        ingresoTarjetas: input.ingresoTarjetas,
        ingresoTransferencias: input.ingresoTransferencias,
        ingresoEfectivo: input.ingresoEfectivo,
        gastosDiarios: input.gastosDiarios,
        otrosAbonos: input.otrosAbonos,
        comentarios: input.comentarios ?? null,
        status: input.status,
        changeReason: input.reason ?? null,
        consultasMonto: input.consultas,
        controlesMonto: input.controles,
        testsMonto: input.tests,
        vacunasMonto: input.vacunas,
        licenciasMonto: input.licencias,
        roxairMonto: input.roxair,
      });

      return {
        item: mapProductionBalanceResponse(updated),
        status: "ok" as const,
      };
    }),
};

export const productionBalancesORPCRouter = base
  .prefix("/api/orpc/production-balances")
  .router(productionBalancesORPCRouterBase);

export const productionBalancesORPCHandler = new SuperJSONRPCHandler(productionBalancesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.production-balances",
      });
    }),
  ],
});

export const productionBalancesOpenAPIHandler = new OpenAPIHandler(productionBalancesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Production Balances oRPC",
          description: "Contratos oRPC/OpenAPI para balances diarios de producción.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.production-balances",
      });
    }),
  ],
});

export type ProductionBalancesORPCRouter = typeof productionBalancesORPCRouter;
