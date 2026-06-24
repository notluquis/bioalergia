import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  type DteTypeCode,
  type FolioInfo,
  type TaxpayerInfo,
  type EmittedDte,
  emitFromOrder,
  getTaxpayerInfo,
  getUF,
  listEmitted,
  listFolios,
} from "../modules/haulmer/dte-client.ts";
import {
  dteEmitInputSchema,
  dteEmitResponseSchema,
  dteFoliosResponseSchema,
  dteListEmittedInputSchema,
  dteListEmittedResponseSchema,
  dteTaxpayerResponseSchema,
  dteUfResponseSchema,
} from "@finanzas/orpc-contracts/haulmer-dte";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";

import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type HaulmerDteORPCContext = { hono: HonoContext };
const base = os.$context<HaulmerDteORPCContext>();

const requireStaff = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const haulmerDteORPCRouterBase = {
  folios: requireStaff
    .route({ method: "GET", path: "/folios", summary: "Folios disponibles", tags: ["Haulmer DTE"] })
    .output(dteFoliosResponseSchema)
    .handler(async () => {
      const rows: FolioInfo[] = await listFolios();
      return {
        data: rows.map((r) => ({
          dte: r.dte,
          tipo: r.tipo,
          siguiente: r.siguiente,
          disponibles: r.disponibles,
          disponibles_web: r.disponibles_web,
          alerta: r.alerta,
          fecha_sii: r.fecha_sii,
        })),
        status: "ok" as const,
      };
    }),

  taxpayer: requireStaff
    .route({
      method: "GET",
      path: "/taxpayer",
      summary: "Info contribuyente",
      tags: ["Haulmer DTE"],
    })
    .output(dteTaxpayerResponseSchema)
    .handler(async () => {
      const t: TaxpayerInfo = await getTaxpayerInfo();
      return {
        data: {
          rut: t.rut,
          dv: t.dv,
          razon_social: t.razon_social,
          giro: t.giro,
          email: t.email,
          direccion: t.direccion,
          comuna_nombre: t.comuna_nombre,
          config_extra_nombre_fantasia: t.config_extra_nombre_fantasia,
        },
        status: "ok" as const,
      };
    }),

  uf: requireStaff
    .route({ method: "GET", path: "/uf", summary: "UF actual", tags: ["Haulmer DTE"] })
    .output(dteUfResponseSchema)
    .handler(async () => {
      const u = await getUF();
      return { data: { periodo: u.periodo, valor: u.valor }, status: "ok" as const };
    }),

  emitted: requireStaff
    .route({ method: "POST", path: "/emitted", summary: "DTEs emitidos", tags: ["Haulmer DTE"] })
    .input(dteListEmittedInputSchema)
    .output(dteListEmittedResponseSchema)
    .handler(async ({ input }) => {
      const res = await listEmitted({
        dteType: input.dte_type as DteTypeCode | undefined,
        page: input.page,
        limit: input.limit,
      });
      return {
        data: res.data.map((d: EmittedDte) => ({
          TipoDTE: d.TipoDTE,
          NombreDTE: d.NombreDTE,
          Folio: d.Folio,
          RUTRecep: d.RUTRecep,
          RznSocRecep: d.RznSocRecep,
          FchEmis: d.FchEmis,
          MntNeto: d.MntNeto,
          MntExe: d.MntExe,
          IVA: d.IVA,
          MntTotal: d.MntTotal,
          RevisionEstado: d.RevisionEstado,
          RevisionDetalle: d.RevisionDetalle,
          Token: d.Token,
        })),
        meta: { current_page: res.current_page, last_page: res.last_page, total: res.total },
        status: "ok" as const,
      };
    }),

  emit: requireStaff
    .route({
      method: "POST",
      path: "/emit",
      summary: "Emitir boleta/factura",
      tags: ["Haulmer DTE"],
    })
    .input(dteEmitInputSchema)
    .output(dteEmitResponseSchema)
    .handler(async ({ input }) => {
      const r = await emitFromOrder({
        documentType: input.document_type,
        customerRut: input.customer_rut ?? "66666666-6",
        customerName: input.customer_name,
        lines: input.lines.map((l) => ({
          sku: l.sku,
          name: l.name,
          qty: l.qty,
          unitPriceClp: l.unit_price_clp,
        })),
        totalClp: input.total_clp,
      });
      return {
        data: {
          folio: String(r.folio),
          type: input.document_type === "BOLETA" ? "39" : "33",
          ...(r.pdfUrl ? { pdf_url: r.pdfUrl } : {}),
        },
        status: "ok" as const,
      };
    }),
};

export const haulmerDteORPCRouter = base
  .prefix("/api/orpc/haulmer-dte")
  .tag("Haulmer DTE")
  .router(haulmerDteORPCRouterBase);

export const haulmerDteORPCHandler = new SuperJSONRPCHandler(haulmerDteORPCRouter, {
  interceptors: [onError((error) => logError("haulmer-dte.orpc.rpc", error, {}))],
});

export const haulmerDteOpenAPIHandler = new OpenAPIHandler(haulmerDteORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Haulmer DTE API",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia Haulmer DTE", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("haulmer-dte.orpc.openapi", error, {}))],
});

export type HaulmerDteORPCRouter = typeof haulmerDteORPCRouter;
