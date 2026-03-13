import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  timesheetBulkInputSchema,
  timesheetEmailPayloadInputSchema,
  timesheetEmployeeDetailInputSchema,
  timesheetEmployeeRangeInputSchema,
  timesheetEntryResponseSchema,
  timesheetListRangeResponseSchema,
  timesheetMonthInputSchema,
  timesheetMonthsResponseSchema,
  timesheetMultiDetailInputSchema,
  timesheetMultiDetailResponseSchema,
  timesheetMultiMonthInputSchema,
  timesheetMultiMonthResponseSchema,
  timesheetPayloadSchema,
  timesheetPrepareEmailPayloadResponseSchema,
  timesheetPrepareEmailResponseSchema,
  timesheetRangeInputSchema,
  timesheetRangeResponseSchema,
  timesheetRemoveInputSchema,
  timesheetSalarySummaryInputSchema,
  timesheetSalarySummaryResponseSchema,
  timesheetStatusResponseSchema,
  timesheetSummaryResponseSchema,
  timesheetUpdateInputSchema,
  timesheetsContract,
} from "@finanzas/orpc-contracts/timesheets";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { getEmployeeById } from "../services/employees";
import {
  buildMonthlySummary,
  deleteTimesheetEntry,
  listTimesheetEntries,
  normalizeTimesheetPayload,
  type UpsertTimesheetPayload,
  updateTimesheetEntry,
  upsertTimesheetEntry,
} from "../services/timesheets";
import { SuperJSONRPCHandler } from "./superjson";

dayjs.extend(utc);
dayjs.extend(timezone);
configureSuperjson();

const TIMEZONE = "America/Santiago";
const EMAIL_FROM_ADDRESS = "lpulgar@bioalergia.cl";
const PDF_FILENAME = "resumen_honorarios.pdf";

type TimesheetsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<TimesheetsORPCContext>();

const emailSummarySchema = z.object({
  net: z.number(),
  overtimeMinutes: z.number().optional(),
  payDate: z.string(),
  retention: z.number(),
  retention_rate: z.number().nullable().optional(),
  retentionRate: z.number().nullable().optional(),
  role: z.string(),
  subtotal: z.number(),
  workedMinutes: z.number().optional(),
});

const multiDetailEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  employee_id: z.number(),
  employee_name: z.string().optional(),
  employee_role: z.string().nullable().optional(),
  end_time: z.string().nullable(),
  full_name: z.string().optional(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  work_date: z.union([z.string(), z.date()]),
  worked_minutes: z.number(),
});

function defaultRangeQuery(query: { from?: string | null; to?: string | null }) {
  return {
    from: query.from || dayjs.tz(TIMEZONE).startOf("month").format("YYYY-MM-DD"),
    to: query.to || dayjs.tz(TIMEZONE).endOf("month").format("YYYY-MM-DD"),
  };
}

async function getHistoricalDateRange() {
  const minResult = await db.employeeTimesheet.findMany({
    orderBy: { workDate: "asc" },
    select: { workDate: true },
    take: 1,
  });
  const maxResult = await db.employeeTimesheet.findMany({
    orderBy: { workDate: "desc" },
    select: { workDate: true },
    take: 1,
  });

  const from = minResult[0]
    ? dayjs.utc(minResult[0].workDate).format("YYYY-MM-DD")
    : dayjs.tz(TIMEZONE).subtract(12, "month").format("YYYY-MM-DD");
  const to = maxResult[0]
    ? dayjs.utc(maxResult[0].workDate).format("YYYY-MM-DD")
    : dayjs.tz(TIMEZONE).format("YYYY-MM-DD");

  return { from, to };
}

async function buildSalarySummaryData(from: string, to: string, employeeIds?: number[]) {
  const startMonth = dayjs.tz(from, "YYYY-MM-DD", TIMEZONE);
  const endMonth = dayjs.tz(to, "YYYY-MM-DD", TIMEZONE);
  let current = startMonth.clone().startOf("month");
  const months: string[] = [];

  while (current.isBefore(endMonth.endOf("month")) || current.isSame(endMonth, "month")) {
    months.push(current.format("YYYY-MM"));
    current = current.add(1, "month");
  }

  const data: Record<
    string,
    Array<{ month: string; net: number; retention: number; subtotal: number }>
  > = {};

  for (const month of months) {
    const monthStart = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
    const monthEnd = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");
    const summary = await buildMonthlySummary(monthStart, monthEnd);

    for (const employee of summary.employees) {
      if (!employeeIds || employeeIds.length === 0 || employeeIds.includes(employee.employeeId)) {
        const key = String(employee.employeeId);
        if (!data[key]) {
          data[key] = [];
        }
        data[key].push({
          month,
          net: employee.net,
          retention: employee.retention,
          subtotal: employee.subtotal,
        });
      }
    }
  }

  return data;
}

function buildTimesheetEmailHtml({
  employeeName,
  month,
  monthLabel,
  summary,
}: {
  employeeName: string;
  month: string;
  monthLabel: string;
  summary: z.infer<typeof emailSummarySchema>;
}) {
  const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;
  const boletaDescription = `SERVICIOS PROFESIONALES DE ${summary.role.toUpperCase()} - PERIODO ${monthLabel.toUpperCase()} - TIEMPO FACTURABLE ${totalHoursFormatted}`;
  const fmtCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", { currency: "CLP", style: "currency" }).format(amount);
  const summaryYear = month
    ? Number.parseInt(month.split("-")[0] ?? "2024", 10)
    : new Date().getFullYear();
  const employeeRate = summary.retentionRate || summary.retention_rate || null;
  const effectiveRate = employeeRate ?? (summaryYear >= 2024 ? 0.1275 : 0.1);
  const retentionPercent = `${(effectiveRate * 100).toFixed(2)}%`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<p>Estimado/a <strong>${employeeName}</strong>,</p>
<p>Periodo <strong>${monthLabel}</strong>.</p>
<p>${boletaDescription}</p>
<p>Monto bruto: ${fmtCLP(summary.subtotal)}</p>
<p>Retención (${retentionPercent}): ${fmtCLP(summary.retention)}</p>
<p>Líquido estimado: ${fmtCLP(summary.net)}</p>
<p>Fecha estimada de pago: ${summary.payDate}</p>
</body></html>`.trim();
}

function buildTimesheetEmailPayload({
  employeeEmail,
  employeeName,
  month,
  monthLabel,
  pdfBase64,
  summary,
}: z.infer<typeof timesheetEmailPayloadInputSchema>) {
  return {
    attachments: [
      {
        contentBase64: pdfBase64,
        contentType: "application/pdf",
        filename: PDF_FILENAME,
      },
    ],
    from: EMAIL_FROM_ADDRESS,
    html: buildTimesheetEmailHtml({ employeeName, month, monthLabel, summary }),
    subject: `Boleta de Honorarios - ${monthLabel} - ${employeeName}`,
    to: employeeEmail,
  };
}

function buildEmlFromPayload(payload: ReturnType<typeof buildTimesheetEmailPayload>) {
  const boundary = `----=_Part_${Date.now()}`;
  return [
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    `Subject: ${payload.subject}`,
    `From: ${payload.from}`,
    `To: ${payload.to}`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    payload.html,
    "",
    `--${boundary}`,
    `Content-Type: ${payload.attachments[0].contentType}; name="${payload.attachments[0].filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${payload.attachments[0].filename}"`,
    "",
    payload.attachments[0].contentBase64,
    `--${boundary}--`,
  ].join("\r\n");
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return next({ context: { ...context, user } });
});

const readTimesheets = authed.use(async ({ context, next }) => {
  const checks = await Promise.all([
    hasPermission(context.user.id, "read", "Timesheet"),
    hasPermission(context.user.id, "read", "TimesheetList"),
    hasPermission(context.user.id, "read", "TimesheetAudit"),
    hasPermission(context.user.id, "read", "Report"),
  ]);
  if (!checks.some(Boolean)) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const createTimesheets = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Timesheet");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const updateTimesheets = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Timesheet");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const deleteTimesheets = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "Timesheet");
  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const timesheetsORPCRouterBase = {
  bulkUpsert: createTimesheets
    .route({
      method: "POST",
      path: "/bulk",
      summary: "Bulk upsert timesheets",
      tags: ["Timesheets"],
    })
    .input(timesheetBulkInputSchema)
    .output(timesheetStatusResponseSchema)
    .handler(async ({ input }) => {
      let inserted = 0;
      let removed = 0;
      for (const id of input.remove_ids) {
        await deleteTimesheetEntry(Number(id));
        removed++;
      }
      for (const entry of input.entries) {
        const normalized = normalizeTimesheetPayload({ employee_id: input.employee_id, ...entry });
        await upsertTimesheetEntry(normalized as UpsertTimesheetPayload);
        inserted++;
      }
      return { inserted, removed, status: "ok" as const };
    }),

  create: createTimesheets
    .route({ method: "POST", path: "/", summary: "Create timesheet entry", tags: ["Timesheets"] })
    .input(timesheetPayloadSchema)
    .output(timesheetEntryResponseSchema)
    .handler(async ({ input }) => {
      const entry = await upsertTimesheetEntry(
        normalizeTimesheetPayload(input) as UpsertTimesheetPayload,
      );
      return { entry, status: "ok" as const };
    }),

  employeeDetail: readTimesheets
    .route({
      method: "GET",
      path: "/employee-detail",
      summary: "Get employee timesheet detail",
      tags: ["Timesheets"],
    })
    .input(timesheetEmployeeDetailInputSchema)
    .output(timesheetRangeResponseSchema)
    .handler(async ({ input }) => {
      const month = input.month || dayjs.tz(TIMEZONE).format("YYYY-MM");
      const from = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const to = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");
      const entries = await listTimesheetEntries({ employee_id: input.employeeId, from, to });
      return { entries, from, status: "ok" as const, to };
    }),

  employeeRange: readTimesheets
    .route({
      method: "GET",
      path: "/employee-range",
      summary: "Get employee timesheet range",
      tags: ["Timesheets"],
    })
    .input(timesheetEmployeeRangeInputSchema)
    .output(timesheetRangeResponseSchema)
    .handler(async ({ input }) => {
      const startDate = input.startDate || dayjs.tz(TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const endDate = input.endDate || dayjs.tz(TIMEZONE).endOf("month").format("YYYY-MM-DD");
      const entries = await listTimesheetEntries({
        employee_id: input.employeeId,
        from: startDate,
        to: endDate,
      });
      return { entries, from: startDate, status: "ok" as const, to: endDate };
    }),

  listRange: readTimesheets
    .route({
      method: "GET",
      path: "/range",
      summary: "List global timesheet range",
      tags: ["Timesheets"],
    })
    .input(timesheetRangeInputSchema)
    .output(timesheetListRangeResponseSchema)
    .handler(async ({ input }) => {
      const { from, to } = defaultRangeQuery(input);
      const entries = await listTimesheetEntries({ from, to });
      return { entries, status: "ok" as const };
    }),

  months: readTimesheets
    .route({ method: "GET", path: "/months", summary: "List months", tags: ["Timesheets"] })
    .output(timesheetMonthsResponseSchema)
    .handler(async () => {
      const months: string[] = [];
      const today = dayjs();
      for (let i = 0; i < 24; i++) {
        months.push(today.subtract(i, "month").format("YYYY-MM"));
      }
      return { months, monthsWithData: [], status: "ok" as const };
    }),

  multiDetail: readTimesheets
    .route({
      method: "GET",
      path: "/multi-detail",
      summary: "Get timesheets for multiple employees",
      tags: ["Timesheets"],
    })
    .input(timesheetMultiDetailInputSchema)
    .output(timesheetMultiDetailResponseSchema)
    .handler(async ({ input }) => {
      const { from, to } = defaultRangeQuery(input);
      const allEntries: Array<z.infer<typeof multiDetailEntrySchema>> = [];
      for (const employeeId of input.employeeIds) {
        const [employee, entries] = await Promise.all([
          getEmployeeById(employeeId),
          listTimesheetEntries({ employee_id: employeeId, from, to }),
        ]);
        allEntries.push(
          ...entries.map((entry) => ({
            ...entry,
            employee_name: employee?.person?.names || "Desconocido",
            employee_role: employee?.position || null,
            full_name: employee?.person?.names,
          })),
        );
      }
      return { entries: allEntries };
    }),

  multiMonth: readTimesheets
    .route({
      method: "GET",
      path: "/multi-month",
      summary: "Get timesheets for multiple months",
      tags: ["Timesheets"],
    })
    .input(timesheetMultiMonthInputSchema)
    .output(timesheetMultiMonthResponseSchema)
    .handler(async ({ input }) => {
      const start = input.startMonth || dayjs.tz(TIMEZONE).format("YYYY-MM");
      const end = input.endMonth || start;
      const from = dayjs.tz(start, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const to = dayjs.tz(end, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");
      const data: Record<
        string,
        { entries: Awaited<ReturnType<typeof listTimesheetEntries>>; month: string }
      > = {};
      for (const employeeId of input.employeeIds) {
        data[String(employeeId)] = {
          entries: await listTimesheetEntries({ employee_id: employeeId, from, to }),
          month: start,
        };
      }
      return { data, status: "ok" as const };
    }),

  prepareEmail: readTimesheets
    .route({
      method: "POST",
      path: "/prepare-email",
      summary: "Prepare legacy EML email",
      tags: ["Timesheets"],
    })
    .input(timesheetEmailPayloadInputSchema)
    .output(timesheetPrepareEmailResponseSchema)
    .handler(async ({ input }) => {
      const payload = buildTimesheetEmailPayload(input);
      const filename = `resumen_honorarios_${input.month}_${input.employeeId}.eml`;
      const emlBase64 = Buffer.from(buildEmlFromPayload(payload)).toString("base64");
      return { emlBase64, filename, status: "ok" as const };
    }),

  prepareEmailPayload: readTimesheets
    .route({
      method: "POST",
      path: "/prepare-email-payload",
      summary: "Prepare mail payload",
      tags: ["Timesheets"],
    })
    .input(timesheetEmailPayloadInputSchema)
    .output(timesheetPrepareEmailPayloadResponseSchema)
    .handler(async ({ input }) => ({
      payload: buildTimesheetEmailPayload(input),
      status: "ok" as const,
    })),

  remove: deleteTimesheets
    .route({
      method: "DELETE",
      path: "/entry",
      summary: "Delete timesheet entry",
      tags: ["Timesheets"],
    })
    .input(timesheetRemoveInputSchema)
    .output(timesheetStatusResponseSchema)
    .handler(async ({ input }) => {
      await deleteTimesheetEntry(input.id);
      return { status: "ok" as const };
    }),

  salarySummary: readTimesheets
    .route({
      method: "GET",
      path: "/salary-summary",
      summary: "Get salary summary",
      tags: ["Timesheets"],
    })
    .input(timesheetSalarySummaryInputSchema)
    .output(timesheetSalarySummaryResponseSchema)
    .handler(async ({ input }) => {
      let from: string;
      let to: string;
      if (!input.from && !input.to) {
        ({ from, to } = await getHistoricalDateRange());
      } else {
        ({ from, to } = defaultRangeQuery({
          from: input.from ?? undefined,
          to: input.to ?? undefined,
        }));
      }
      return {
        data: await buildSalarySummaryData(from, to, input.employeeIds),
        from,
        status: "ok" as const,
        to,
      };
    }),

  summary: readTimesheets
    .route({
      method: "GET",
      path: "/summary",
      summary: "Get monthly timesheet summary",
      tags: ["Timesheets"],
    })
    .input(timesheetMonthInputSchema)
    .output(timesheetSummaryResponseSchema)
    .handler(async ({ input }) => {
      const month = input.month || dayjs.tz(TIMEZONE).format("YYYY-MM");
      const from = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const to = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");
      const summary = await buildMonthlySummary(from, to, input.employeeId);
      return { ...summary, from, month, status: "ok" as const, to };
    }),

  update: updateTimesheets
    .route({
      method: "PUT",
      path: "/entry",
      summary: "Update timesheet entry",
      tags: ["Timesheets"],
    })
    .input(timesheetUpdateInputSchema)
    .output(timesheetEntryResponseSchema)
    .handler(async ({ input }) => {
      const entry = await updateTimesheetEntry(input.id, input.payload);
      return { entry, status: "ok" as const };
    }),
};

export const timesheetsORPCRouter = base
  .prefix("/api/orpc/timesheets")
  .tag("Timesheets")
  .router(timesheetsORPCRouterBase);

export const timesheetsORPCHandler = new SuperJSONRPCHandler(timesheetsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("timesheets.orpc", error, { module: "api", operation: "orpc.timesheets" });
    }),
  ],
});

export const timesheetsOpenAPIHandler = new OpenAPIHandler(timesheetsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Timesheets API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Timesheets API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("timesheets.openapi", error, { module: "api", operation: "openapi.timesheets" });
    }),
  ],
});

export type TimesheetsORPCRouter = typeof timesheetsORPCRouter;
export type TimesheetsORPCContract = typeof timesheetsContract;
