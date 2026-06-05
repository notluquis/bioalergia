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
  dteFetchXmlByPeriodInputSchema,
  dteFetchXmlByPeriodResponseSchema,
  dteFetchXmlInputSchema,
  dteFetchXmlResponseSchema,
  dteLineItemsQuerySchema,
  dteLineItemsResponseSchema,
  dteXmlJobStatusResponseSchema,
} from "@finanzas/orpc-contracts/dte-analytics";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import type { Context as HonoContext } from "hono";
import { sql } from "kysely";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { dbDateToISO, TIMEZONE } from "../lib/time.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

const parsePeriodStart = (period: string) =>
  dayjs.tz(`${period}-01`, "YYYY-MM-DD", TIMEZONE).startOf("month");
const parsePeriodEnd = (period: string) =>
  dayjs.tz(`${period}-01`, "YYYY-MM-DD", TIMEZONE).endOf("month");

configureSuperjson();

type DteAnalyticsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DteAnalyticsORPCContext>();

function excludeAnnulledByNCE(
  tableAlias: string,
  table: "DTESaleDetail" | "DTEPurchaseDetail"
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
  const canRead = await hasPermission(context.user, "read", "DTEPurchaseDetail");

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
        const startDate = parsePeriodStart(input.period).toISOString();
        const endDate = parsePeriodEnd(input.period).toISOString();
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
          sql<number>`(
            SELECT COUNT(*)::int
            FROM dte_line_items li
            WHERE li.dte_purchase_detail_id = p.id
          )`.as("lineItemsCount"),
        ])
        .orderBy(sql`p.document_date`, "desc")
        .orderBy(sql`p.register_number`, "desc")
        .limit(input.pageSize)
        .offset(offset)
        .execute();

      const total = Number(totalResult?.total ?? 0);

      return {
        data: rows.map((row) => ({
          documentDate: dbDateToISO(row.documentDate) ?? "",
          documentType: Number(row.documentType),
          exemptAmount: Number(row.exemptAmount),
          folio: row.folio,
          id: row.id,
          lineItemsCount: Number((row as Record<string, unknown>).lineItemsCount ?? 0),
          netAmount: Number(row.netAmount),
          nonRecoverableIVA: Number(row.nonRecoverableIVA),
          providerName: row.providerName,
          providerRUT: row.providerRUT,
          purchaseType: row.purchaseType,
          receiptDate: dbDateToISO(row.receiptDate) ?? "",
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
          sql<boolean>`p.document_date >= ${parsePeriodStart(input.startPeriod).toISOString()}`
        );
      }
      if (input.endPeriod) {
        query = query.where(
          sql<boolean>`p.document_date <= ${parsePeriodEnd(input.endPeriod).toISOString()}`
        );
      }
      if (input.year) {
        // document_date is @db.Date — compare date-to-date so a Jan-1 / Dec-31
        // row isn't dropped by a TZ-shifted instant boundary (UTC-3 -> 03:00Z).
        query = query
          .where(sql<boolean>`p.document_date >= ${`${input.year}-01-01`}::date`)
          .where(sql<boolean>`p.document_date <= ${`${input.year}-12-31`}::date`);
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
        const startDate = parsePeriodStart(input.period).toISOString();
        const endDate = parsePeriodEnd(input.period).toISOString();
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
          sql<number>`(
            SELECT COUNT(*)::int
            FROM dte_line_items li
            WHERE li.dte_sale_detail_id = s.id
          )`.as("lineItemsCount"),
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
          documentDate: dbDateToISO(row.documentDate) ?? "",
          documentType: Number(row.documentType),
          emitterRUT: row.emitterRUT,
          exemptAmount: Number(row.exemptAmount),
          folio: row.folio,
          id: row.id,
          ivaAmount: Number(row.ivaAmount),
          lineItemsCount: Number((row as Record<string, unknown>).lineItemsCount ?? 0),
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
    .handler(
      async ({ input }: { input: z.output<typeof dteAnalyticsSalesLinkedEventsQuerySchema> }) => {
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
            lineItemsCount: number;
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
          ) AS "linkedEventsCount",
          (
            SELECT COUNT(*)::int
            FROM dte_line_items li
            WHERE li.dte_sale_detail_id = s.id
          ) AS "lineItemsCount"
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
            seriesKind:
              | null
              | "PATCH_TEST"
              | "SKIN_TEST"
              | "SUBCUTANEOUS_TREATMENT"
              | "MEDICAL_CONSULTATION";
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
              documentDate: dbDateToISO(dteRow.documentDate) ?? "",
              documentType: Number(dteRow.documentType),
              emitterRUT: dteRow.emitterRUT,
              exemptAmount: Number(dteRow.exemptAmount),
              folio: dteRow.folio,
              id: dteRow.id,
              ivaAmount: Number(dteRow.ivaAmount),
              lineItemsCount: Number(dteRow.lineItemsCount),
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
      }
    ),

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
          sql<boolean>`s.document_date >= ${parsePeriodStart(input.startPeriod).toISOString()}`
        );
      }
      if (input.endPeriod) {
        query = query.where(
          sql<boolean>`s.document_date <= ${parsePeriodEnd(input.endPeriod).toISOString()}`
        );
      }
      if (input.year) {
        // document_date is @db.Date — compare date-to-date (see purchases query).
        query = query
          .where(sql<boolean>`s.document_date >= ${`${input.year}-01-01`}::date`)
          .where(sql<boolean>`s.document_date <= ${`${input.year}-12-31`}::date`);
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

  lineItems: readDteAnalytics
    .route({ method: "GET", path: "/line-items" })
    .input(dteLineItemsQuerySchema)
    .output(dteLineItemsResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteLineItemsQuerySchema> }) => {
      const fkColumn = input.direction === "sale" ? "dte_sale_detail_id" : "dte_purchase_detail_id";

      const rows = await db.$queryRaw<
        Array<{
          id: string;
          lineNumber: number;
          itemName: string;
          itemDescription: null | string;
          quantity: number;
          unit: null | string;
          unitPrice: number;
          amount: number;
          isExempt: boolean;
          itemCode: null | string;
          itemCodeType: null | string;
          discountPercent: null | number;
          discountAmount: null | number;
        }>
      >`
        SELECT
          li.id AS "id",
          li.line_number AS "lineNumber",
          li.item_name AS "itemName",
          li.item_description AS "itemDescription",
          li.quantity::float AS "quantity",
          li.unit AS "unit",
          li.unit_price::float AS "unitPrice",
          li.amount::float AS "amount",
          li.is_exempt AS "isExempt",
          li.item_code AS "itemCode",
          li.item_code_type AS "itemCodeType",
          li.discount_percent::float AS "discountPercent",
          li.discount_amount::float AS "discountAmount"
        FROM dte_line_items li
        WHERE ${sql.raw(`li.${fkColumn}`)} = ${input.dteId}
        ORDER BY li.line_number ASC
      `;

      return {
        data: rows.map((row) => ({
          id: row.id,
          lineNumber: Number(row.lineNumber),
          itemName: row.itemName,
          itemDescription: row.itemDescription,
          quantity: Number(row.quantity),
          unit: row.unit,
          unitPrice: Number(row.unitPrice),
          amount: Number(row.amount),
          isExempt: Boolean(row.isExempt),
          itemCode: row.itemCode,
          itemCodeType: row.itemCodeType,
          discountPercent: row.discountPercent != null ? Number(row.discountPercent) : null,
          discountAmount: row.discountAmount != null ? Number(row.discountAmount) : null,
        })),
        status: "success" as const,
      };
    }),

  fetchXml: readDteAnalytics
    .route({ method: "POST", path: "/fetch-xml" })
    .input(dteFetchXmlInputSchema)
    .output(dteFetchXmlResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteFetchXmlInputSchema> }) => {
      const { haulmerConfig: cfg } = await import("../lib/config.ts");
      if (!cfg) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Haulmer not configured (missing env vars)",
        });
      }

      const { fetchSaleXmlLineItems, fetchPurchaseXmlLineItems } =
        await import("../modules/haulmer/xml-service.ts");

      const result =
        input.direction === "sales"
          ? await fetchSaleXmlLineItems(input.dteIds, cfg)
          : await fetchPurchaseXmlLineItems(input.dteIds, cfg);

      return { ...result, status: "success" as const };
    }),

  fetchXmlByPeriod: readDteAnalytics
    .route({ method: "POST", path: "/fetch-xml-by-period" })
    .input(dteFetchXmlByPeriodInputSchema)
    .output(dteFetchXmlByPeriodResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof dteFetchXmlByPeriodInputSchema> }) => {
      const { haulmerConfig: cfg } = await import("../lib/config.ts");
      if (!cfg) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Haulmer not configured (missing env vars)",
        });
      }

      const startDate = parsePeriodStart(input.period).toISOString();
      const endDate = parsePeriodEnd(input.period).toISOString();

      let dteIds: string[];
      if (input.direction === "sales") {
        const rows = await db.$queryRaw<Array<{ id: string }>>`
            SELECT s.id FROM dte_sale_details s
            WHERE s.document_date >= ${startDate}
              AND s.document_date <= ${endDate}
              AND s.document_type <> 61
              ${input.onlyMissing ? sql`AND NOT EXISTS (SELECT 1 FROM dte_line_items li WHERE li.dte_sale_detail_id = s.id)` : sql``}
            ORDER BY s.document_date DESC
          `;
        dteIds = rows.map((r) => r.id);
      } else {
        const rows = await db.$queryRaw<Array<{ id: string }>>`
            SELECT p.id FROM dte_purchase_details p
            WHERE p.document_date >= ${startDate}
              AND p.document_date <= ${endDate}
              ${input.onlyMissing ? sql`AND NOT EXISTS (SELECT 1 FROM dte_line_items li WHERE li.dte_purchase_detail_id = p.id)` : sql``}
            ORDER BY p.document_date DESC
          `;
        dteIds = rows.map((r) => r.id);
      }

      if (dteIds.length === 0) {
        return { jobId: "none", total: 0, status: "success" as const };
      }

      const { startXmlFetchJob } = await import("../modules/haulmer/xml-service.ts");
      const jobId = startXmlFetchJob(dteIds, input.direction, cfg);

      return { jobId, total: dteIds.length, status: "success" as const };
    }),

  xmlJobStatus: readDteAnalytics
    .route({ method: "GET", path: "/xml-job-status" })
    .output(dteXmlJobStatusResponseSchema)
    .handler(async () => {
      const { getActiveXmlFetchJob } = await import("../modules/haulmer/xml-service.ts");
      const { getJobStatus } = await import("../lib/jobQueue.ts");

      const activeJob = getActiveXmlFetchJob();
      if (activeJob) {
        return {
          job: {
            id: activeJob.id,
            status: activeJob.status,
            progress: activeJob.progress,
            total: activeJob.total,
            message: activeJob.message,
            meta: activeJob.meta,
            error: activeJob.error,
          },
          status: "success" as const,
        };
      }

      return { job: null, status: "success" as const };
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
