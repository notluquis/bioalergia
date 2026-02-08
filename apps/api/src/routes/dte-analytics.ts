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
import { reply } from "../utils/reply";

export const dteAnalyticsRoutes = new Hono();

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
        sql<number>`coalesce(sum(p.net_amount), 0)`.as("netAmount"),
        sql<number>`coalesce(sum(p.recoverable_iva), 0)`.as("taxAmount"),
        sql<number>`coalesce(avg(p.total_amount), 0)`.as("averageAmount"),
      ])
      .groupBy(sql`to_char(p.document_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(p.document_date, 'YYYY-MM')`, "desc");

    // Apply filters using SQL for proper date filtering
    if (startPeriod) {
      const startDate = dayjs(startPeriod).startOf("month").toISOString();
      query = query.where(sql`p.document_date`, ">=", startDate);
    }
    if (endPeriod) {
      const endDate = dayjs(endPeriod).endOf("month").toISOString();
      query = query.where(sql`p.document_date`, "<=", endDate);
    }
    if (year) {
      const yearStart = dayjs().year(year).startOf("year").toISOString();
      const yearEnd = dayjs().year(year).endOf("year").toISOString();
      query = query.where(sql`p.document_date`, ">=", yearStart);
      query = query.where(sql`p.document_date`, "<=", yearEnd);
    }

    const results = await query.execute();

    // Format results
    const summary = results.map((row) => ({
      period: row.period || "",
      count: Number(row.count),
      totalAmount: Number(row.totalAmount),
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
        sql<number>`coalesce(sum(s.net_amount), 0)`.as("netAmount"),
        sql<number>`coalesce(sum(s.iva_amount), 0)`.as("taxAmount"),
        sql<number>`coalesce(avg(s.total_amount), 0)`.as("averageAmount"),
      ])
      .groupBy(sql`to_char(s.document_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(s.document_date, 'YYYY-MM')`, "desc");

    // Apply filters
    if (startPeriod) {
      const startDate = dayjs(startPeriod).startOf("month").toISOString();
      query = query.where(sql`s.document_date`, ">=", startDate);
    }
    if (endPeriod) {
      const endDate = dayjs(endPeriod).endOf("month").toISOString();
      query = query.where(sql`s.document_date`, "<=", endDate);
    }
    if (year) {
      const yearStart = dayjs().year(year).startOf("year").toISOString();
      const yearEnd = dayjs().year(year).endOf("year").toISOString();
      query = query.where(sql`s.document_date`, ">=", yearStart);
      query = query.where(sql`s.document_date`, "<=", yearEnd);
    }

    const results = await query.execute();

    // Format results
    const summary = results.map((row) => ({
      period: row.period || "",
      count: Number(row.count),
      totalAmount: Number(row.totalAmount),
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
          .where(sql`p.document_date`, ">=", year1Start)
          .where(sql`p.document_date`, "<=", year1End)
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
          .where(sql`p.document_date`, ">=", year2Start)
          .where(sql`p.document_date`, "<=", year2End)
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
          .where(sql`s.document_date`, ">=", year1Start)
          .where(sql`s.document_date`, "<=", year1End)
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
          .where(sql`s.document_date`, ">=", year2Start)
          .where(sql`s.document_date`, "<=", year2End)
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
