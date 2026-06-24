import { oc } from "@orpc/contract";
import { z } from "zod";

export const folioInfoSchema = z.object({
  dte: z.number().int(),
  tipo: z.string(),
  siguiente: z.number().int(),
  disponibles: z.number().int(),
  disponibles_web: z.number().int(),
  alerta: z.number().int(),
  fecha_sii: z.string().nullable(),
});

export const taxpayerInfoSchema = z.object({
  rut: z.number().int(),
  dv: z.string(),
  razon_social: z.string(),
  giro: z.string(),
  email: z.string(),
  direccion: z.string(),
  comuna_nombre: z.string(),
  config_extra_nombre_fantasia: z.string(),
});

export const emittedDteSchema = z.object({
  TipoDTE: z.number().int(),
  NombreDTE: z.string(),
  Folio: z.number().int(),
  RUTRecep: z.number().int(),
  RznSocRecep: z.string().nullable(),
  FchEmis: z.string(),
  MntNeto: z.number().int(),
  MntExe: z.number().int(),
  IVA: z.number().int(),
  MntTotal: z.number().int(),
  RevisionEstado: z.string(),
  RevisionDetalle: z.string(),
  Token: z.string(),
});

export const dteFoliosResponseSchema = z.object({
  data: z.array(folioInfoSchema),
  status: z.literal("ok"),
});

export const dteTaxpayerResponseSchema = z.object({
  data: taxpayerInfoSchema,
  status: z.literal("ok"),
});

export const dteUfResponseSchema = z.object({
  data: z.object({
    periodo: z.number().int(),
    valor: z.number(),
  }),
  status: z.literal("ok"),
});

export const dteListEmittedInputSchema = z.object({
  dte_type: z.number().int().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(15),
});

export const dteListEmittedResponseSchema = z.object({
  data: z.array(emittedDteSchema),
  meta: z.object({
    current_page: z.number().int(),
    last_page: z.number().int(),
    total: z.number().int(),
  }),
  status: z.literal("ok"),
});

export const dteEmitInputSchema = z.object({
  document_type: z.enum(["BOLETA", "FACTURA"]),
  customer_rut: z.string().optional(),
  customer_name: z.string(),
  lines: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        qty: z.number().int().positive(),
        unit_price_clp: z.number().int().positive(),
      })
    )
    .min(1),
  total_clp: z.number().int().positive(),
});

export const dteEmitResponseSchema = z.object({
  data: z.object({
    folio: z.string(),
    type: z.string(),
    pdf_url: z.string().optional(),
  }),
  status: z.literal("ok"),
});

export const haulmerDteContract = {
  folios: oc.route({ method: "GET", path: "/folios" }).output(dteFoliosResponseSchema),
  taxpayer: oc.route({ method: "GET", path: "/taxpayer" }).output(dteTaxpayerResponseSchema),
  uf: oc.route({ method: "GET", path: "/uf" }).output(dteUfResponseSchema),
  emitted: oc
    .route({ method: "POST", path: "/emitted" })
    .input(dteListEmittedInputSchema)
    .output(dteListEmittedResponseSchema),
  emit: oc
    .route({ method: "POST", path: "/emit" })
    .input(dteEmitInputSchema)
    .output(dteEmitResponseSchema),
};

export type HaulmerDteContract = typeof haulmerDteContract;
