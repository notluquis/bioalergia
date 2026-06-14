// Lógica de lectura de analítica DTE, fuera de los handlers oRPC (golden 2026:
// handlers finos). Los servicios hacen las queries Kysely/raw y devuelven el
// payload tipado del contrato; el handler queda: authz → service → return.
//
// NOTA: estos servicios NO lanzan DomainError salvo NOT_FOUND (salesLinkedEvents),
// porque las demás operaciones son lecturas que siempre tienen forma válida. El
// handler conserva el guard de Haulmer-no-configurado como ORPCError("INTERNAL")
// (no hay DomainError kind INTERNAL).

import { db } from "@finanzas/db";
import type {
  dteAnalyticsDetailsQuerySchema,
  dteAnalyticsPeriodParamsSchema,
  dteAnalyticsPeriodsResponseSchema,
  dteAnalyticsPurchasesDetailsResponseSchema,
  dteAnalyticsSalesDetailsResponseSchema,
  dteAnalyticsSalesLinkedEventsQuerySchema,
  dteAnalyticsSalesLinkedEventsResponseSchema,
  dteAnalyticsSummaryResponseSchema,
  dteLineItemsQuerySchema,
  dteLineItemsResponseSchema,
} from "@finanzas/orpc-contracts/dte-analytics";
import { sql } from "kysely";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { dbDateToISO, getMonthRange } from "../lib/time.ts";

// Month bounds as "YYYY-MM-DD" date literals. document_date is @db.Date, so
// comparisons must be date-to-date — NOT against a Santiago-shifted instant
// (the old dayjs.tz(...).toISOString() dropped boundary-day rows under UTC).
const periodStartDate = (period: string): string => getMonthRange(period).from;
const periodEndDate = (period: string): string => getMonthRange(period).to;

// NCE annulment filter: a sale row annulled by a Nota de Crédito Electrónica
// (document_type 61) referencing it must be excluded. Purchases have no such
// rule → `true`.
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

type DetailsQuery = z.output<typeof dteAnalyticsDetailsQuerySchema>;
type PeriodParams = z.output<typeof dteAnalyticsPeriodParamsSchema>;
type LineItemsQuery = z.output<typeof dteLineItemsQuerySchema>;
type SalesLinkedEventsQuery = z.output<typeof dteAnalyticsSalesLinkedEventsQuerySchema>;

type PeriodsResponse = z.infer<typeof dteAnalyticsPeriodsResponseSchema>;
type PurchasesDetailsResponse = z.infer<typeof dteAnalyticsPurchasesDetailsResponseSchema>;
type SalesDetailsResponse = z.infer<typeof dteAnalyticsSalesDetailsResponseSchema>;
type SummaryResponse = z.infer<typeof dteAnalyticsSummaryResponseSchema>;
type LineItemsResponse = z.infer<typeof dteLineItemsResponseSchema>;
type SalesLinkedEventsResponse = z.infer<typeof dteAnalyticsSalesLinkedEventsResponseSchema>;

export async function getPurchasesAvailablePeriods(): Promise<PeriodsResponse> {
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
}

export async function getPurchasesDetails(input: DetailsQuery): Promise<PurchasesDetailsResponse> {
  const offset = (input.page - 1) * input.pageSize;

  let countQuery = db.$qb
    .selectFrom("DTEPurchaseDetail as p")
    .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

  let dataQuery = db.$qb
    .selectFrom("DTEPurchaseDetail as p")
    .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

  if (input.period) {
    const startDate = periodStartDate(input.period);
    const endDate = periodEndDate(input.period);
    countQuery = countQuery
      .where(sql<boolean>`p.document_date >= ${startDate}::date`)
      .where(sql<boolean>`p.document_date <= ${endDate}::date`);
    dataQuery = dataQuery
      .where(sql<boolean>`p.document_date >= ${startDate}::date`)
      .where(sql<boolean>`p.document_date <= ${endDate}::date`);
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
}

export async function getPurchasesSummary(input: PeriodParams): Promise<SummaryResponse> {
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
    query = query.where(sql<boolean>`p.document_date >= ${periodStartDate(input.startPeriod)}::date`);
  }
  if (input.endPeriod) {
    query = query.where(sql<boolean>`p.document_date <= ${periodEndDate(input.endPeriod)}::date`);
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
}

export async function getSalesAvailablePeriods(): Promise<PeriodsResponse> {
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
}

export async function getSalesDetails(input: DetailsQuery): Promise<SalesDetailsResponse> {
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
    const startDate = periodStartDate(input.period);
    const endDate = periodEndDate(input.period);
    countQuery = countQuery
      .where(sql<boolean>`s.document_date >= ${startDate}::date`)
      .where(sql<boolean>`s.document_date <= ${endDate}::date`);
    dataQuery = dataQuery
      .where(sql<boolean>`s.document_date >= ${startDate}::date`)
      .where(sql<boolean>`s.document_date <= ${endDate}::date`);
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
}

export async function getSalesSummary(input: PeriodParams): Promise<SummaryResponse> {
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
    query = query.where(sql<boolean>`s.document_date >= ${periodStartDate(input.startPeriod)}::date`);
  }
  if (input.endPeriod) {
    query = query.where(sql<boolean>`s.document_date <= ${periodEndDate(input.endPeriod)}::date`);
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
}

export async function getSalesLinkedEvents(
  input: SalesLinkedEventsQuery
): Promise<SalesLinkedEventsResponse> {
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
    throw new DomainError("NOT_FOUND", "DTE de venta no encontrado");
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

export async function getLineItems(input: LineItemsQuery): Promise<LineItemsResponse> {
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
}

// fetch-xml-by-period: selecciona los ids de DTE en el período (filtrando los
// que ya tienen line items si onlyMissing). Devuelve los ids; el handler decide
// el arranque del job (trigger, no DB business logic).
export async function selectDtesForXmlFetch(input: {
  direction: "sales" | "purchases";
  onlyMissing: boolean;
  period: string;
}): Promise<string[]> {
  const startDate = periodStartDate(input.period);
  const endDate = periodEndDate(input.period);

  if (input.direction === "sales") {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT s.id FROM dte_sale_details s
      WHERE s.document_date >= ${startDate}::date
        AND s.document_date <= ${endDate}::date
        AND s.document_type <> 61
        ${input.onlyMissing ? sql`AND NOT EXISTS (SELECT 1 FROM dte_line_items li WHERE li.dte_sale_detail_id = s.id)` : sql``}
      ORDER BY s.document_date DESC
    `;
    return rows.map((r) => r.id);
  }

  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM dte_purchase_details p
    WHERE p.document_date >= ${startDate}::date
      AND p.document_date <= ${endDate}::date
      ${input.onlyMissing ? sql`AND NOT EXISTS (SELECT 1 FROM dte_line_items li WHERE li.dte_purchase_detail_id = p.id)` : sql``}
    ORDER BY p.document_date DESC
  `;
  return rows.map((r) => r.id);
}
