import { db } from "@finanzas/db";
import {
  dteAnalyticsDetailsQuerySchema,
  dteAnalyticsPeriodParamsSchema,
  dteAnalyticsPeriodsResponseSchema,
  dteAnalyticsPurchasesDetailsResponseSchema,
  dteAnalyticsSalesLinkedEventsQuerySchema,
  dteAnalyticsSalesLinkedEventsResponseSchema,
  dteAnalyticsSalesDetailsResponseSchema,
  dteAnalyticsSummaryResponseSchema,
} from "@finanzas/orpc-contracts/dte-analytics";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import type { Context as HonoContext } from "hono";
import { sql } from "kysely";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type DteAnalyticsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DteAnalyticsORPCContext>();

function excludeAnnulledByNCE(
  tableAlias: string,
  table: "DTESaleDetail" | "DTEPurchaseDetail",
): ReturnType<typeof sql<boolean>> {
  if (table === "DTEPurchaseDetail") {
    return sql<boolean>`true`;
  }

  const tableName = '"public"."dte_sale_details"';

  return sql<boolean>`NOT EXISTS (
    SELECT 1 FROM ${sql.raw(tableName)} AS nce
    WHERE nce."document_type" = 61
    AND nce."reference_doc_type" = ${sql.raw(`${tableAlias}."document_type"`)}::varchar
    AND nce."reference_doc_folio" = ${sql.raw(`${tableAlias}."folio"`)}
  )`;
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

const readDteAnalytics = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "DTEPurchaseDetail");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const dteAnalyticsORPCRouterBase = {
  purchasesAvailablePeriods: readDteAnalytics
    .route({ method: "GET", path: "/purchases/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema)
    .handler(async () => {
      const rows = await db.$qb
        .selectFrom("DTEPurchaseDetail as p")
        .select(sql<string>`to_char(p.document_date, 'YYYY-MM')`.as("period"))
        .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"))
        .groupBy(sql`to_char(p.document_date, 'YYYY-MM')`)
        .orderBy(sql`to_char(p.document_date, 'YYYY-MM')`, "desc")
        .execute();

      return {
        data: rows.map((row) => row.period).filter(Boolean),
        status: "success" as const,
      };
    }),

  purchasesDetails: readDteAnalytics
    .route({ method: "GET", path: "/purchases/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsPurchasesDetailsResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteAnalyticsDetailsQuerySchema> }) => {
      const offset = (input.page - 1) * input.pageSize;

      let countQuery = db.$qb
        .selectFrom("DTEPurchaseDetail as p")
        .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

      let dataQuery = db.$qb
        .selectFrom("DTEPurchaseDetail as p")
        .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

      if (input.period) {
        const startDate = dayjs(input.period).startOf("month").toISOString();
        const endDate = dayjs(input.period).endOf("month").toISOString();
        countQuery = countQuery
          .where(sql<boolean>`p.document_date >= ${startDate}`)
          .where(sql<boolean>`p.document_date <= ${endDate}`);
        dataQuery = dataQuery
          .where(sql<boolean>`p.document_date >= ${startDate}`)
          .where(sql<boolean>`p.document_date <= ${endDate}`);
      }

      const totalResult = await countQuery
        .select(sql<number>`count(p.id)::int`.as("total"))
        .executeTakeFirst();

      const rows = await dataQuery
        .select([
          sql<string>`p.id`.as("id"),
          sql<number>`p.document_type`.as("documentType"),
          sql<string>`p.purchase_type`.as("purchaseType"),
          sql<string>`p.provider_rut`.as("providerRUT"),
          sql<string>`p.provider_name`.as("providerName"),
          sql<string>`p.folio`.as("folio"),
          sql<Date>`p.document_date`.as("documentDate"),
          sql<Date>`p.receipt_date`.as("receiptDate"),
          sql<number>`coalesce(p.exempt_amount, 0)`.as("exemptAmount"),
          sql<number>`coalesce(p.net_amount, 0)`.as("netAmount"),
          sql<number>`coalesce(p.recoverable_iva, 0)`.as("recoverableIVA"),
          sql<number>`coalesce(p.non_recoverable_iva, 0)`.as("nonRecoverableIVA"),
          sql<number>`coalesce(p.total_amount, 0)`.as("totalAmount"),
        ])
        .orderBy(sql`p.document_date`, "desc")
        .orderBy(sql`p.register_number`, "desc")
        .limit(input.pageSize)
        .offset(offset)
        .execute();

      const total = Number(totalResult?.total ?? 0);

      return {
        data: rows.map((row) => ({
          documentDate: dayjs(row.documentDate).format("YYYY-MM-DD"),
          documentType: Number(row.documentType),
          exemptAmount: Number(row.exemptAmount),
          folio: row.folio,
          id: row.id,
          netAmount: Number(row.netAmount),
          nonRecoverableIVA: Number(row.nonRecoverableIVA),
          providerName: row.providerName,
          providerRUT: row.providerRUT,
          purchaseType: row.purchaseType,
          receiptDate: dayjs(row.receiptDate).format("YYYY-MM-DD"),
          recoverableIVA: Number(row.recoverableIVA),
          totalAmount: Number(row.totalAmount),
        })),
        meta: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
        status: "success" as const,
      };
    }),

  purchasesSummary: readDteAnalytics
    .route({ method: "GET", path: "/purchases/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteAnalyticsPeriodParamsSchema> }) => {
      let query = db.$qb
        .selectFrom("DTEPurchaseDetail as p")
        .select([
          sql<string>`to_char(p.document_date, 'YYYY-MM')`.as("period"),
          sql<number>`count(p.id)::int`.as("count"),
          sql<number>`coalesce(sum(p.total_amount), 0)`.as("totalAmount"),
          sql<number>`coalesce(sum(p.exempt_amount), 0)`.as("exemptAmount"),
          sql<number>`coalesce(sum(p.net_amount), 0)`.as("netAmount"),
          sql<number>`coalesce(sum(p.recoverable_iva), 0)`.as("taxAmount"),
          sql<number>`coalesce(avg(p.total_amount), 0)`.as("averageAmount"),
        ])
        .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"))
        .groupBy(sql`to_char(p.document_date, 'YYYY-MM')`)
        .orderBy(sql`to_char(p.document_date, 'YYYY-MM')`, "desc");

      if (input.startPeriod) {
        query = query.where(
          sql<boolean>`p.document_date >= ${dayjs(input.startPeriod).startOf("month").toISOString()}`,
        );
      }
      if (input.endPeriod) {
        query = query.where(
          sql<boolean>`p.document_date <= ${dayjs(input.endPeriod).endOf("month").toISOString()}`,
        );
      }
      if (input.year) {
        query = query
          .where(
            sql<boolean>`p.document_date >= ${dayjs().year(input.year).startOf("year").toISOString()}`,
          )
          .where(
            sql<boolean>`p.document_date <= ${dayjs().year(input.year).endOf("year").toISOString()}`,
          );
      }

      const results = await query.execute();

      return {
        data: results.map((row) => ({
          averageAmount: Number(row.averageAmount),
          count: Number(row.count),
          exemptAmount: Number(row.exemptAmount),
          netAmount: Number(row.netAmount),
          period: row.period || "",
          taxAmount: Number(row.taxAmount),
          totalAmount: Number(row.totalAmount),
        })),
        status: "success" as const,
      };
    }),

  salesAvailablePeriods: readDteAnalytics
    .route({ method: "GET", path: "/sales/available-periods" })
    .output(dteAnalyticsPeriodsResponseSchema)
    .handler(async () => {
      const rows = await db.$qb
        .selectFrom("DTESaleDetail as s")
        .select(sql<string>`to_char(s.document_date, 'YYYY-MM')`.as("period"))
        .where(sql<boolean>`s.document_type <> 61`)
        .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
        .groupBy(sql`to_char(s.document_date, 'YYYY-MM')`)
        .orderBy(sql`to_char(s.document_date, 'YYYY-MM')`, "desc")
        .execute();

      return {
        data: rows.map((row) => row.period).filter(Boolean),
        status: "success" as const,
      };
    }),

  salesDetails: readDteAnalytics
    .route({ method: "GET", path: "/sales/details" })
    .input(dteAnalyticsDetailsQuerySchema)
    .output(dteAnalyticsSalesDetailsResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteAnalyticsDetailsQuerySchema> }) => {
      const offset = (input.page - 1) * input.pageSize;

      let countQuery = db.$qb
        .selectFrom("DTESaleDetail as s")
        .where(sql<boolean>`s.document_type <> 61`)
        .where(excludeAnnulledByNCE("s", "DTESaleDetail"));

      let dataQuery = db.$qb
        .selectFrom("DTESaleDetail as s")
        .where(sql<boolean>`s.document_type <> 61`)
        .where(excludeAnnulledByNCE("s", "DTESaleDetail"));

      if (input.period) {
        const startDate = dayjs(input.period).startOf("month").toISOString();
        const endDate = dayjs(input.period).endOf("month").toISOString();
        countQuery = countQuery
          .where(sql<boolean>`s.document_date >= ${startDate}`)
          .where(sql<boolean>`s.document_date <= ${endDate}`);
        dataQuery = dataQuery
          .where(sql<boolean>`s.document_date >= ${startDate}`)
          .where(sql<boolean>`s.document_date <= ${endDate}`);
      }

      const totalResult = await countQuery
        .select(sql<number>`count(s.id)::int`.as("total"))
        .executeTakeFirst();

      const rows = await dataQuery
        .select([
          sql<string>`s.id`.as("id"),
          sql<number>`s.document_type`.as("documentType"),
          sql<string>`s.sale_type`.as("saleType"),
          sql<string>`s.client_rut`.as("clientRUT"),
          sql<string>`s.client_name`.as("clientName"),
          sql<string>`s.folio`.as("folio"),
          sql<Date>`s.document_date`.as("documentDate"),
          sql<number>`coalesce(s.exempt_amount, 0)`.as("exemptAmount"),
          sql<number>`coalesce(s.net_amount, 0)`.as("netAmount"),
          sql<number>`coalesce(s.iva_amount, 0)`.as("ivaAmount"),
          sql<number>`coalesce(s.total_amount, 0)`.as("totalAmount"),
          sql<null | string>`s.emitter_rut`.as("emitterRUT"),
          sql<null | string>`s.reference_doc_type`.as("referenceDocType"),
          sql<null | string>`s.reference_doc_folio`.as("referenceDocFolio"),
          sql<number>`(
            SELECT COUNT(*)::int
            FROM event_dte_sale_links l
            WHERE l.dte_sale_detail_id = s.id
          )`.as("linkedEventsCount"),
        ])
        .orderBy(sql`s.document_date`, "desc")
        .orderBy(sql`s.register_number`, "desc")
        .limit(input.pageSize)
        .offset(offset)
        .execute();

      const total = Number(totalResult?.total ?? 0);

      return {
        data: rows.map((row) => ({
          clientName: row.clientName,
          clientRUT: row.clientRUT,
          documentDate: dayjs(row.documentDate).format("YYYY-MM-DD"),
          documentType: Number(row.documentType),
          emitterRUT: row.emitterRUT,
          exemptAmount: Number(row.exemptAmount),
          folio: row.folio,
          id: row.id,
          ivaAmount: Number(row.ivaAmount),
          netAmount: Number(row.netAmount),
          referenceDocFolio: row.referenceDocFolio,
          referenceDocType: row.referenceDocType,
          saleType: row.saleType,
          linkedEventsCount: Number(row.linkedEventsCount),
          totalAmount: Number(row.totalAmount),
        })),
        meta: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
        status: "success" as const,
      };
    }),

  salesLinkedEvents: readDteAnalytics
    .route({ method: "GET", path: "/sales/linked-events" })
    .input(dteAnalyticsSalesLinkedEventsQuerySchema)
    .output(dteAnalyticsSalesLinkedEventsResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteAnalyticsSalesLinkedEventsQuerySchema> }) => {
      const dte = await db.$queryRaw<
        Array<{
          clientName: string;
          clientRUT: string;
          documentDate: Date;
          documentType: number;
          emitterRUT: null | string;
          exemptAmount: number;
          folio: string;
          id: string;
          ivaAmount: number;
          linkedEventsCount: number;
          netAmount: number;
          referenceDocFolio: null | string;
          referenceDocType: null | string;
          saleType: string;
          totalAmount: number;
        }>
      >`
        SELECT
          s.id AS "id",
          s.document_type AS "documentType",
          s.sale_type AS "saleType",
          s.client_rut AS "clientRUT",
          s.client_name AS "clientName",
          s.folio AS "folio",
          s.document_date AS "documentDate",
          COALESCE(s.exempt_amount, 0)::float AS "exemptAmount",
          COALESCE(s.net_amount, 0)::float AS "netAmount",
          COALESCE(s.iva_amount, 0)::float AS "ivaAmount",
          COALESCE(s.total_amount, 0)::float AS "totalAmount",
          s.emitter_rut AS "emitterRUT",
          s.reference_doc_type AS "referenceDocType",
          s.reference_doc_folio AS "referenceDocFolio",
          (
            SELECT COUNT(*)::int
            FROM event_dte_sale_links l
            WHERE l.dte_sale_detail_id = s.id
          ) AS "linkedEventsCount"
        FROM dte_sale_details s
        WHERE s.id = ${input.dteSaleDetailId}
        LIMIT 1
      `;

      const dteRow = dte[0];

      if (!dteRow) {
        throw new ORPCError("NOT_FOUND", { message: "DTE de venta no encontrado" });
      }

      const linkedEvents = await db.$queryRaw<
        Array<{
          amountExpected: null | number;
          amountPaid: null | number;
          calendarId: string;
          confidenceScore: null | number;
          displayName: null | string;
          eventDate: string;
          eventId: string;
          eventTime: null | string;
          matchedBy: null | string;
          seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
          summary: null | string;
        }>
      >`
        SELECT
          c.google_id AS "calendarId",
          e.external_event_id AS "eventId",
          e.summary AS "summary",
          COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD')) AS "eventDate",
          to_char(e.start_date_time AT TIME ZONE 'America/Santiago', 'HH24:MI') AS "eventTime",
          e.amount_expected AS "amountExpected",
          e.amount_paid AS "amountPaid",
          l.matched_by AS "matchedBy",
          l.confidence_score::float AS "confidenceScore",
          cs.display_name AS "displayName",
          cs.kind AS "seriesKind"
        FROM event_dte_sale_links l
        JOIN events e ON e.id = l.event_id
        JOIN calendars c ON c.id = e.calendar_id
        LEFT JOIN clinical_series cs ON cs.id = e.clinical_series_id
        WHERE l.dte_sale_detail_id = ${input.dteSaleDetailId}
        ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE 'America/Santiago')::date) DESC, e.start_date_time DESC NULLS LAST, e.id DESC
      `;

      return {
        data: {
          dte: {
            clientName: dteRow.clientName,
            clientRUT: dteRow.clientRUT,
            documentDate: dayjs(dteRow.documentDate).format("YYYY-MM-DD"),
            documentType: Number(dteRow.documentType),
            emitterRUT: dteRow.emitterRUT,
            exemptAmount: Number(dteRow.exemptAmount),
            folio: dteRow.folio,
            id: dteRow.id,
            ivaAmount: Number(dteRow.ivaAmount),
            netAmount: Number(dteRow.netAmount),
            referenceDocFolio: dteRow.referenceDocFolio,
            referenceDocType: dteRow.referenceDocType,
            saleType: dteRow.saleType,
            linkedEventsCount: Number(dteRow.linkedEventsCount),
            totalAmount: Number(dteRow.totalAmount),
          },
          linkedEvents,
        },
        status: "success" as const,
      };
    }),

  salesSummary: readDteAnalytics
    .route({ method: "GET", path: "/sales/summary" })
    .input(dteAnalyticsPeriodParamsSchema)
    .output(dteAnalyticsSummaryResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteAnalyticsPeriodParamsSchema> }) => {
      let query = db.$qb
        .selectFrom("DTESaleDetail as s")
        .select([
          sql<string>`to_char(s.document_date, 'YYYY-MM')`.as("period"),
          sql<number>`count(s.id)::int`.as("count"),
          sql<number>`coalesce(sum(s.total_amount), 0)`.as("totalAmount"),
          sql<number>`coalesce(sum(s.exempt_amount), 0)`.as("exemptAmount"),
          sql<number>`coalesce(sum(s.net_amount), 0)`.as("netAmount"),
          sql<number>`coalesce(sum(s.iva_amount), 0)`.as("taxAmount"),
          sql<number>`coalesce(avg(s.total_amount), 0)`.as("averageAmount"),
        ])
        .where("s.documentType", "<>", 61)
        .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
        .groupBy(sql`to_char(s.document_date, 'YYYY-MM')`)
        .orderBy(sql`to_char(s.document_date, 'YYYY-MM')`, "desc");

      if (input.startPeriod) {
        query = query.where(
          sql<boolean>`s.document_date >= ${dayjs(input.startPeriod).startOf("month").toISOString()}`,
        );
      }
      if (input.endPeriod) {
        query = query.where(
          sql<boolean>`s.document_date <= ${dayjs(input.endPeriod).endOf("month").toISOString()}`,
        );
      }
      if (input.year) {
        query = query
          .where(
            sql<boolean>`s.document_date >= ${dayjs().year(input.year).startOf("year").toISOString()}`,
          )
          .where(
            sql<boolean>`s.document_date <= ${dayjs().year(input.year).endOf("year").toISOString()}`,
          );
      }

      const results = await query.execute();

      return {
        data: results.map((row) => ({
          averageAmount: Number(row.averageAmount),
          count: Number(row.count),
          exemptAmount: Number(row.exemptAmount),
          netAmount: Number(row.netAmount),
          period: row.period || "",
          taxAmount: Number(row.taxAmount),
          totalAmount: Number(row.totalAmount),
        })),
        status: "success" as const,
      };
    }),
};

export const dteAnalyticsORPCRouter = base
  .prefix("/api/orpc/dte-analytics")
  .router(dteAnalyticsORPCRouterBase);

export const dteAnalyticsORPCHandler = new SuperJSONRPCHandler(dteAnalyticsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.dte-analytics",
      });
    }),
  ],
});

export const dteAnalyticsOpenAPIHandler = new OpenAPIHandler(dteAnalyticsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia DTE Analytics oRPC",
          description: "Contratos oRPC/OpenAPI para resúmenes y detalles DTE.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.dte-analytics",
      });
    }),
  ],
});

export type DteAnalyticsORPCRouter = typeof dteAnalyticsORPCRouter;
