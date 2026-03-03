/**
 * DTE Analytics Routes for Hono API
 *
 * Provides endpoints for analyzing and visualizing DTE (Chilean tax documents) data
 */

import { db } from "@finanzas/db";
import dayjs from "dayjs";
import { Hono } from "hono";
import { sql } from "kysely";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { zValidator } from "../lib/zod-validator";
import {
  autoLinkEventDate,
  confirmEventDteLink,
  getEventDteSuggestions,
  listEventDteLinkOverview,
  listEventDteLinksByDate,
  normalizeLinkDate,
  unlinkEventDteLink,
} from "../services/dte-event-linking";
import { reply } from "../utils/reply";

export const dteAnalyticsRoutes = new Hono();

/**
 * Helper function to exclude documents annulled by electronic credit notes (NCE tipo 61)
 * An NCE (Nota de Crédito Electrónica) with documentType=61 references and nullifies
 * a previous document via reference_doc_type + reference_doc_folio
 *
 * Note: Only applies to DTESaleDetail. DTEPurchaseDetail uses reference_doc_note instead.
 */
function excludeAnnulledByNCE(
  tableAlias: string,
  table: "DTESaleDetail" | "DTEPurchaseDetail",
): ReturnType<typeof sql<boolean>> {
  // NCE filtering only applies to sales (which have reference_doc_type and reference_doc_folio)
  // Purchases use reference_doc_note instead and don't need this filter
  if (table === "DTEPurchaseDetail") {
    // No NCE exclusion for purchases - return condition that is always true
    return sql<boolean>`true`;
  }

  // Sales: exclude records referenced by NCE (Credit Notes tipo 61)
  const tableName = '"public"."dte_sale_details"';

  return sql<boolean>`NOT EXISTS (
    SELECT 1 FROM ${sql.raw(tableName)} AS nce
    WHERE nce."document_type" = 61
    AND nce."reference_doc_type" = ${sql.raw(`${tableAlias}."document_type"`)}::varchar
    AND nce."reference_doc_folio" = ${sql.raw(`${tableAlias}."folio"`)}
  )`;
}

const periodParamsSchema = z.object({
  startPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // Format: YYYY-MM
  endPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  year: z.coerce.number().int().min(2020).max(2030).optional(),
});

const yearlyComparisonSchema = z.object({
  year1: z.coerce.number().int().min(2020).max(2030),
  year2: z.coerce.number().int().min(2020).max(2030),
  type: z.enum(["purchases", "sales"]),
});

const detailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const eventLinkByDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const eventLinkOverviewQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  query: z.string().optional(),
  status: z.enum(["all", "linked", "unlinked"]).default("all"),
});

const eventLinkSuggestionsQuerySchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

const confirmEventLinkSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
  dteSaleDetailId: z.string().min(1),
  confidenceScore: z.number().min(0).max(100).optional(),
  matchedBy: z.enum(["manual", "mixed", "name_exact", "name_fuzzy", "rut"]).optional(),
  matchedName: z.string().nullable().optional(),
  matchedRUT: z.string().nullable().optional(),
});

const unlinkEventLinkSchema = z.object({
  calendarId: z.string().min(1),
  eventId: z.string().min(1),
});

const autoLinkDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minScore: z.number().min(0).max(100).optional(),
});

/**
 * GET /purchases/summary - Get purchase summary by period
 */
dteAnalyticsRoutes.get("/purchases/summary", zValidator("query", periodParamsSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { startPeriod, endPeriod, year } = c.req.valid("query");

  try {
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

    // Apply filters using SQL for proper date filtering
    if (startPeriod) {
      const startDate = dayjs(startPeriod).startOf("month").toISOString();
      query = query.where(sql<boolean>`p.document_date >= ${startDate}`);
    }
    if (endPeriod) {
      const endDate = dayjs(endPeriod).endOf("month").toISOString();
      query = query.where(sql<boolean>`p.document_date <= ${endDate}`);
    }
    if (year) {
      const yearStart = dayjs().year(year).startOf("year").toISOString();
      const yearEnd = dayjs().year(year).endOf("year").toISOString();
      query = query.where(sql<boolean>`p.document_date >= ${yearStart}`);
      query = query.where(sql<boolean>`p.document_date <= ${yearEnd}`);
    }

    const results = await query.execute();

    // Format results
    const summary = results.map((row) => ({
      period: row.period || "",
      count: Number(row.count),
      totalAmount: Number(row.totalAmount),
      exemptAmount: Number(row.exemptAmount),
      netAmount: Number(row.netAmount),
      taxAmount: Number(row.taxAmount),
      averageAmount: Number(row.averageAmount),
    }));

    return reply(c, { status: "success", data: summary });
  } catch (error) {
    console.error("Error fetching purchase summary:", error);
    return reply(c, { status: "error", message: "Failed to retrieve purchase summary" }, 500);
  }
});

/**
 * GET /sales/summary - Get sales summary by period
 */
dteAnalyticsRoutes.get("/sales/summary", zValidator("query", periodParamsSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { startPeriod, endPeriod, year } = c.req.valid("query");

  try {
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
      .where("s.documentType", "<>", 61) // Exclude NCEs (type 61)
      .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
      .groupBy(sql`to_char(s.document_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(s.document_date, 'YYYY-MM')`, "desc");

    // Apply filters
    if (startPeriod) {
      const startDate = dayjs(startPeriod).startOf("month").toISOString();
      query = query.where(sql<boolean>`s.document_date >= ${startDate}`);
    }
    if (endPeriod) {
      const endDate = dayjs(endPeriod).endOf("month").toISOString();
      query = query.where(sql<boolean>`s.document_date <= ${endDate}`);
    }
    if (year) {
      const yearStart = dayjs().year(year).startOf("year").toISOString();
      const yearEnd = dayjs().year(year).endOf("year").toISOString();
      query = query.where(sql<boolean>`s.document_date >= ${yearStart}`);
      query = query.where(sql<boolean>`s.document_date <= ${yearEnd}`);
    }

    const results = await query.execute();

    // Format results
    const summary = results.map((row) => ({
      period: row.period || "",
      count: Number(row.count),
      totalAmount: Number(row.totalAmount),
      exemptAmount: Number(row.exemptAmount),
      netAmount: Number(row.netAmount),
      taxAmount: Number(row.taxAmount),
      averageAmount: Number(row.averageAmount),
    }));

    return reply(c, { status: "success", data: summary });
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    return reply(c, { status: "error", message: "Failed to retrieve sales summary" }, 500);
  }
});

/**
 * GET /yearly-comparison - Get year-over-year comparison
 */
dteAnalyticsRoutes.get(
  "/yearly-comparison",
  zValidator("query", yearlyComparisonSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canRead) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    const { year1, year2, type } = c.req.valid("query");

    try {
      // Get data for year 1
      const year1Start = dayjs().year(year1).startOf("year").toISOString();
      const year1End = dayjs().year(year1).endOf("year").toISOString();

      // Get data for year 2
      const year2Start = dayjs().year(year2).startOf("year").toISOString();
      const year2End = dayjs().year(year2).endOf("year").toISOString();

      let year1Data: Array<{ month: string; totalAmount: number; count: number }> = [];
      let year2Data: Array<{ month: string; totalAmount: number; count: number }> = [];

      if (type === "purchases") {
        year1Data = await db.$qb
          .selectFrom("DTEPurchaseDetail as p")
          .select([
            sql<string>`to_char(p.document_date, 'MM')`.as("month"),
            sql<number>`coalesce(sum(p.total_amount), 0)`.as("totalAmount"),
            sql<number>`count(p.id)::int`.as("count"),
          ])
          .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"))
          .where(sql<boolean>`p.document_date >= ${year1Start}`)
          .where(sql<boolean>`p.document_date <= ${year1End}`)
          .groupBy(sql`to_char(p.document_date, 'MM')`)
          .orderBy(sql`to_char(p.document_date, 'MM')`)
          .execute();

        year2Data = await db.$qb
          .selectFrom("DTEPurchaseDetail as p")
          .select([
            sql<string>`to_char(p.document_date, 'MM')`.as("month"),
            sql<number>`coalesce(sum(p.total_amount), 0)`.as("totalAmount"),
            sql<number>`count(p.id)::int`.as("count"),
          ])
          .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"))
          .where(sql<boolean>`p.document_date >= ${year2Start}`)
          .where(sql<boolean>`p.document_date <= ${year2End}`)
          .groupBy(sql`to_char(p.document_date, 'MM')`)
          .orderBy(sql`to_char(p.document_date, 'MM')`)
          .execute();
      } else {
        year1Data = await db.$qb
          .selectFrom("DTESaleDetail as s")
          .select([
            sql<string>`to_char(s.document_date, 'MM')`.as("month"),
            sql<number>`coalesce(sum(s.total_amount), 0)`.as("totalAmount"),
            sql<number>`count(s.id)::int`.as("count"),
          ])
          .where("s.documentType", "<>", 61) // Exclude NCEs
          .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
          .where(sql<boolean>`s.document_date >= ${year1Start}`)
          .where(sql<boolean>`s.document_date <= ${year1End}`)
          .groupBy(sql`to_char(s.document_date, 'MM')`)
          .orderBy(sql`to_char(s.document_date, 'MM')`)
          .execute();

        year2Data = await db.$qb
          .selectFrom("DTESaleDetail as s")
          .select([
            sql<string>`to_char(s.document_date, 'MM')`.as("month"),
            sql<number>`coalesce(sum(s.total_amount), 0)`.as("totalAmount"),
            sql<number>`count(s.id)::int`.as("count"),
          ])
          .where("s.documentType", "<>", 61) // Exclude NCEs
          .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
          .where(sql<boolean>`s.document_date >= ${year2Start}`)
          .where(sql<boolean>`s.document_date <= ${year2End}`)
          .groupBy(sql`to_char(s.document_date, 'MM')`)
          .orderBy(sql`to_char(s.document_date, 'MM')`)
          .execute();
      }

      // Format and merge data by month
      const monthMap = new Map<
        string,
        {
          month: string;
          year1Value: number;
          year2Value: number;
          year1Count: number;
          year2Count: number;
        }
      >();

      // Initialize all 12 months
      for (let i = 1; i <= 12; i++) {
        const month = i.toString().padStart(2, "0");
        monthMap.set(month, {
          month,
          year1Value: 0,
          year2Value: 0,
          year1Count: 0,
          year2Count: 0,
        });
      }

      for (const row of year1Data) {
        const existing = monthMap.get(row.month) || {
          month: row.month,
          year1Value: 0,
          year2Value: 0,
          year1Count: 0,
          year2Count: 0,
        };
        monthMap.set(row.month, {
          ...existing,
          year1Value: Number(row.totalAmount),
          year1Count: Number(row.count),
        });
      }

      for (const row of year2Data) {
        const existing = monthMap.get(row.month) || {
          month: row.month,
          year1Value: 0,
          year2Value: 0,
          year1Count: 0,
          year2Count: 0,
        };
        monthMap.set(row.month, {
          ...existing,
          year2Value: Number(row.totalAmount),
          year2Count: Number(row.count),
        });
      }

      const comparison = Array.from(monthMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );

      return reply(c, {
        status: "success",
        data: comparison,
      });
    } catch (error) {
      console.error("Error fetching yearly comparison:", error);
      return reply(c, { status: "error", message: "Failed to retrieve yearly comparison" }, 500);
    }
  },
);

/**
 * GET /event-links/overview - List monthly event links and top scores
 */
dteAnalyticsRoutes.get(
  "/event-links/overview",
  zValidator("query", eventLinkOverviewQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canReadCalendar = await hasPermission(user.id, "read", "CalendarDaily");
    const canReadDte = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canReadCalendar || !canReadDte) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { page, pageSize, period, query, status } = c.req.valid("query");
      const data = await listEventDteLinkOverview({
        page,
        pageSize,
        period,
        query,
        status,
      });
      return reply(c, { status: "success", data });
    } catch (error) {
      return reply(
        c,
        {
          status: "error",
          message: error instanceof Error ? error.message : "Failed to list event links overview",
        },
        400,
      );
    }
  },
);

/**
 * GET /event-links/by-day - List confirmed links for events in a date
 */
dteAnalyticsRoutes.get(
  "/event-links/by-day",
  zValidator("query", eventLinkByDayQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canReadCalendar = await hasPermission(user.id, "read", "CalendarDaily");
    const canReadDte = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canReadCalendar || !canReadDte) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { date } = c.req.valid("query");
      const normalizedDate = normalizeLinkDate(date);
      const data = await listEventDteLinksByDate(normalizedDate);
      return reply(c, { status: "success", data });
    } catch (error) {
      return reply(
        c,
        {
          status: "error",
          message: error instanceof Error ? error.message : "Failed to list links by day",
        },
        400,
      );
    }
  },
);

/**
 * GET /event-links/suggestions - Suggest DTE sale links for one event
 */
dteAnalyticsRoutes.get(
  "/event-links/suggestions",
  zValidator("query", eventLinkSuggestionsQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canReadCalendar = await hasPermission(user.id, "read", "CalendarDaily");
    const canReadDte = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canReadCalendar || !canReadDte) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { calendarId, eventId, limit } = c.req.valid("query");
      const data = await getEventDteSuggestions({ calendarId, eventId, limit });
      return reply(c, { status: "success", data });
    } catch (error) {
      console.error("Error fetching event link suggestions:", error);
      return reply(c, { status: "error", message: "Failed to fetch suggestions" }, 500);
    }
  },
);

/**
 * POST /event-links/confirm - Confirm/overwrite event to DTE link
 */
dteAnalyticsRoutes.post(
  "/event-links/confirm",
  zValidator("json", confirmEventLinkSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canWriteCalendar = await hasPermission(user.id, "update", "CalendarEvent");
    const canReadDte = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canWriteCalendar || !canReadDte) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const payload = c.req.valid("json");
      const data = await confirmEventDteLink({
        ...payload,
        userId: user.id,
      });
      return reply(c, { status: "success", data });
    } catch (error) {
      return reply(
        c,
        {
          status: "error",
          message: error instanceof Error ? error.message : "Failed to confirm link",
        },
        400,
      );
    }
  },
);

/**
 * POST /event-links/unlink - Remove confirmed event to DTE link
 */
dteAnalyticsRoutes.post(
  "/event-links/unlink",
  zValidator("json", unlinkEventLinkSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canWriteCalendar = await hasPermission(user.id, "update", "CalendarEvent");
    if (!canWriteCalendar) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const payload = c.req.valid("json");
      const data = await unlinkEventDteLink(payload);
      return reply(c, { status: "success", data });
    } catch (_error) {
      return reply(c, { status: "error", message: "Failed to unlink" }, 500);
    }
  },
);

/**
 * POST /event-links/auto-link-day - Auto-link confident matches for one day
 */
dteAnalyticsRoutes.post(
  "/event-links/auto-link-day",
  zValidator("json", autoLinkDaySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canWriteCalendar = await hasPermission(user.id, "update", "CalendarEvent");
    const canReadDte = await hasPermission(user.id, "read", "DTEPurchaseDetail");
    if (!canWriteCalendar || !canReadDte) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { date, minScore } = c.req.valid("json");
      const normalizedDate = normalizeLinkDate(date);
      const data = await autoLinkEventDate({
        date: normalizedDate,
        minScore,
        userId: user.id,
      });
      return reply(c, { status: "success", data });
    } catch (error) {
      return reply(
        c,
        {
          status: "error",
          message: error instanceof Error ? error.message : "Failed to auto link events",
        },
        400,
      );
    }
  },
);

/**
 * GET /sales/available-periods - List available periods (YYYY-MM) for sales details
 */
dteAnalyticsRoutes.get("/sales/available-periods", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const rows = await db.$qb
      .selectFrom("DTESaleDetail as s")
      .select(sql<string>`to_char(s.document_date, 'YYYY-MM')`.as("period"))
      .where(sql<boolean>`s.document_type <> 61`)
      .where(excludeAnnulledByNCE("s", "DTESaleDetail"))
      .groupBy(sql`to_char(s.document_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(s.document_date, 'YYYY-MM')`, "desc")
      .execute();

    const periods = rows.map((row) => row.period).filter(Boolean);
    return reply(c, { status: "success", data: periods });
  } catch (error) {
    console.error("Error fetching sales available periods:", error);
    return reply(c, { status: "error", message: "Failed to retrieve sales periods" }, 500);
  }
});

/**
 * GET /purchases/available-periods - List available periods (YYYY-MM) for purchases details
 */
dteAnalyticsRoutes.get("/purchases/available-periods", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const rows = await db.$qb
      .selectFrom("DTEPurchaseDetail as p")
      .select(sql<string>`to_char(p.document_date, 'YYYY-MM')`.as("period"))
      .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"))
      .groupBy(sql`to_char(p.document_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(p.document_date, 'YYYY-MM')`, "desc")
      .execute();

    const periods = rows.map((row) => row.period).filter(Boolean);
    return reply(c, { status: "success", data: periods });
  } catch (error) {
    console.error("Error fetching purchase available periods:", error);
    return reply(c, { status: "error", message: "Failed to retrieve purchase periods" }, 500);
  }
});

/**
 * GET /sales/details - Get paginated sale details by period
 */
dteAnalyticsRoutes.get("/sales/details", zValidator("query", detailsQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { page, pageSize, period } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  try {
    let countQuery = db.$qb
      .selectFrom("DTESaleDetail as s")
      .where(sql<boolean>`s.document_type <> 61`)
      .where(excludeAnnulledByNCE("s", "DTESaleDetail"));

    let dataQuery = db.$qb
      .selectFrom("DTESaleDetail as s")
      .where(sql<boolean>`s.document_type <> 61`)
      .where(excludeAnnulledByNCE("s", "DTESaleDetail"));

    if (period) {
      const startDate = dayjs(period).startOf("month").toISOString();
      const endDate = dayjs(period).endOf("month").toISOString();
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
        sql<number>`s.register_number`.as("registerNumber"),
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
      ])
      .orderBy(sql`s.document_date`, "desc")
      .orderBy(sql`s.register_number`, "desc")
      .limit(pageSize)
      .offset(offset)
      .execute();

    const total = Number(totalResult?.total ?? 0);

    return reply(c, {
      status: "success",
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
        registerNumber: Number(row.registerNumber),
        saleType: row.saleType,
        totalAmount: Number(row.totalAmount),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching sale details:", error);
    return reply(c, { status: "error", message: "Failed to retrieve sale details" }, 500);
  }
});

/**
 * GET /purchases/details - Get paginated purchase details by period
 */
dteAnalyticsRoutes.get("/purchases/details", zValidator("query", detailsQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DTEPurchaseDetail");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { page, pageSize, period } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  try {
    let countQuery = db.$qb
      .selectFrom("DTEPurchaseDetail as p")
      .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

    let dataQuery = db.$qb
      .selectFrom("DTEPurchaseDetail as p")
      .where(excludeAnnulledByNCE("p", "DTEPurchaseDetail"));

    if (period) {
      const startDate = dayjs(period).startOf("month").toISOString();
      const endDate = dayjs(period).endOf("month").toISOString();
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
        sql<number>`p.register_number`.as("registerNumber"),
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
      .limit(pageSize)
      .offset(offset)
      .execute();

    const total = Number(totalResult?.total ?? 0);

    return reply(c, {
      status: "success",
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
        registerNumber: Number(row.registerNumber),
        totalAmount: Number(row.totalAmount),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching purchase details:", error);
    return reply(c, { status: "error", message: "Failed to retrieve purchase details" }, 500);
  }
});
