import { oc } from "@orpc/contract";
import { z } from "zod";

export const productionBalanceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const productionBalancePayloadSchema = z.object({
  comentarios: z.string().nullable().optional(),
  consultas: z.number(),
  controles: z.number(),
  date: z.string(),
  gastosDiarios: z.number(),
  ingresoEfectivo: z.number(),
  ingresoTarjetas: z.number(),
  ingresoTransferencias: z.number(),
  licencias: z.number(),
  otrosAbonos: z.number(),
  reason: z.string().nullable().optional(),
  roxair: z.number(),
  status: z.string(),
  tests: z.number(),
  vacunas: z.number(),
});

export const productionBalanceUpdateSchema = productionBalancePayloadSchema.extend({
  id: z.number().int().positive(),
});

export const productionBalanceItemSchema = z
  .object({
    changeReason: z.string().nullable(),
    comentarios: z.string().nullable(),
    consultasMonto: z.number(),
    controlesMonto: z.number(),
    createdAt: z.coerce.date(),
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
    updatedAt: z.coerce.date(),
    updatedByEmail: z.string().nullable(),
    vacunasMonto: z.number(),
  })
  .passthrough();

export const productionBalancesListResponseSchema = z.object({
  from: z.string(),
  items: z.array(productionBalanceItemSchema),
  status: z.literal("ok"),
  to: z.string(),
});

export const productionBalanceItemResponseSchema = z.object({
  item: productionBalanceItemSchema,
  status: z.literal("ok"),
});

export const productionBalancesContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(productionBalancePayloadSchema)
    .output(productionBalanceItemResponseSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(productionBalanceQuerySchema)
    .output(productionBalancesListResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(productionBalanceUpdateSchema)
    .output(productionBalanceItemResponseSchema),
};

export type ProductionBalancesContract = typeof productionBalancesContract;
