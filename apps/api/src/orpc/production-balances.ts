import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import {
  productionBalancePayloadSchema,
  productionBalanceQuerySchema,
} from "../lib/financial-schemas";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createProductionBalance,
  listProductionBalances,
  updateProductionBalance,
} from "../services/daily-production-balances";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ProductionBalancesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ProductionBalancesORPCContext>();

const listInputSchema = productionBalanceQuerySchema;
const createInputSchema = productionBalancePayloadSchema;
const updateInputSchema = productionBalancePayloadSchema.extend({
  id: z.number().int().positive(),
});

const itemSchema = z
  .object({
    changeReason: z.string().nullable(),
    comentarios: z.string().nullable(),
    consultasMonto: z.number(),
    controlesMonto: z.number(),
    createdAt: z.date(),
    createdByEmail: z.string().nullable(),
    date: z.string(),
    gastosDiarios: z.number(),
    id: z.number(),
    ingresoEfectivo: z.number(),
    ingresoTarjetas: z.number(),
    ingresoTransferencias: z.number(),
    licenciasMonto: z.number(),
    otrosAbonos: z.number(),
    roxairMonto: z.number(),
    status: z.string(),
    subtotalIngresos: z.number(),
    testsMonto: z.number(),
    total: z.number(),
    totalIngresos: z.number(),
    updatedAt: z.date(),
    updatedByEmail: z.string().nullable(),
    vacunasMonto: z.number(),
  })
  .passthrough();

const listResponseSchema = z.object({
  from: z.string(),
  items: z.array(itemSchema),
  status: z.literal("ok"),
  to: z.string(),
});

const itemResponseSchema = z.object({
  item: itemSchema,
  status: z.literal("ok"),
});

type ProductionBalanceWithUser = {
  balanceDate: string;
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

function mapResponse(p: ProductionBalanceWithUser) {
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
  const canRead = await hasPermission(context.user.id, "read", "ProductionBalance");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const writeBalances = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "ProductionBalance");
  const canUpdate = await hasPermission(context.user.id, "update", "ProductionBalance");

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
      summary: "Create daily production balance",
      tags: ["Production Balances"],
    })
    .input(createInputSchema)
    .output(itemResponseSchema)
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
        context.user.id,
      );

      return {
        item: mapResponse(created as unknown as ProductionBalanceWithUser),
        status: "ok" as const,
      };
    }),

  list: readBalances
    .route({
      method: "GET",
      path: "/",
      summary: "List daily production balances",
      tags: ["Production Balances"],
    })
    .input(listInputSchema)
    .output(listResponseSchema)
    .handler(async ({ input }) => {
      const today = dayjs();
      const toDateStr = input.to ?? today.format("YYYY-MM-DD");
      const fromDateStr = input.from ?? today.subtract(30, "day").format("YYYY-MM-DD");
      const items = await listProductionBalances(fromDateStr, toDateStr);

      return {
        status: "ok" as const,
        from: fromDateStr,
        to: toDateStr,
        items: items.map((item) => mapResponse(item as unknown as ProductionBalanceWithUser)),
      };
    }),

  update: writeBalances
    .route({
      method: "PUT",
      path: "/{id}",
      summary: "Update daily production balance",
      tags: ["Production Balances"],
    })
    .input(updateInputSchema)
    .output(itemResponseSchema)
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
        item: mapResponse(updated as unknown as ProductionBalanceWithUser),
        status: "ok" as const,
      };
    }),
};

export const productionBalancesORPCRouter = base
  .router(productionBalancesORPCRouterBase)
  .prefix("/api/orpc/production-balances");

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
      docsPath: "/api/orpc/production-balances/docs",
      specPath: "/api/orpc/production-balances/openapi.json",
      theme: "saturn",
      favicon: "https://orpc.dev/icon.svg",
      layout: "modern",
      meta: {
        title: "Bioalergia Production Balances oRPC",
        description: "Contratos oRPC/OpenAPI para balances diarios de producción.",
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
  schemaConverters: [new ZodToJsonSchemaConverter()],
});
