import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { zValidator } from "../lib/zod-validator";
import { getEmployeeById } from "../services/employees";
import {
  buildMonthlySummary,
  deleteTimesheetEntry,
  listTimesheetEntries,
  normalizeTimesheetPayload,
  type TimesheetEntry,
  type UpsertTimesheetPayload,
  updateTimesheetEntry,
  upsertTimesheetEntry,
} from "../services/timesheets";
import { reply } from "../utils/reply";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

const app = new Hono();

// ============================================================
// SCHEMAS
// ============================================================

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM inválido")
    .optional(),
  employeeId: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const rangeQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// Reuse existing logic defaults
const defaultRangeQuery = (query: { from?: string | null; to?: string | null }) => ({
  from: query.from || dayjs.tz(TIMEZONE).startOf("month").format("YYYY-MM-DD"),
  to: query.to || dayjs.tz(TIMEZONE).endOf("month").format("YYYY-MM-DD"),
});

// Get full historical date range from database
async function getHistoricalDateRange() {
  const minResult = await db.employeeTimesheet.findMany({
    select: { workDate: true },
    orderBy: { workDate: "asc" },
    take: 1,
  });
  const maxResult = await db.employeeTimesheet.findMany({
    select: { workDate: true },
    orderBy: { workDate: "desc" },
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

// Build salary summary data structure
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
    Array<{
      month: string;
      subtotal: number;
      retention: number;
      net: number;
    }>
  > = {};

  // Build monthly data for each month sequentially
  for (const month of months) {
    const monthStart = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
    const monthEnd = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");

    const summary = await buildMonthlySummary(monthStart, monthEnd);

    // Add data for each employee in this month
    for (const emp of summary.employees) {
      if (!data[String(emp.employeeId)]) {
        data[String(emp.employeeId)] = [];
      }

      // Only include if not filtering or if this employee is in the filter list
      if (!employeeIds || employeeIds.length === 0 || employeeIds.includes(emp.employeeId)) {
        data[String(emp.employeeId)].push({
          month,
          subtotal: emp.subtotal,
          retention: emp.retention,
          net: emp.net,
        });
      }
    }
  }

  return data;
}

const multiMonthQuerySchema = z.object({
  employeeIds: z.string().optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const multiDetailQuerySchema = z.object({
  employeeIds: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const employeeIdParamSchema = z.object({
  employeeId: z.string().regex(/^\d+$/, "ID debe ser numérico").transform(Number),
});

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID debe ser numérico").transform(Number),
});

const rangeParamQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const detailMonthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const salarySummaryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  mode: z.enum(["auto", "range"]).default("range"),
  employeeIds: z.string().optional(),
});

const bulkBodySchema = z.object({
  employee_id: z.number(),
  entries: z.array(z.any()).default([]), // Using any for entries as partial validation happens in normalize
  remove_ids: z.array(z.union([z.string(), z.number()])).default([]),
});

const emailBodySchema = z.object({
  employeeId: z.number(),
  month: z.string(),
  monthLabel: z.string(),
  pdfBase64: z.string(),
  employeeName: z.string(),
  employeeEmail: z.email(),
  summary: z.object({
    role: z.string(),
    subtotal: z.number(),
    retention: z.number(),
    net: z.number(),
    payDate: z.string(),
    workedMinutes: z.number().optional(),
    overtimeMinutes: z.number().optional(),
    retentionRate: z.number().optional(),
    retention_rate: z.number().optional(),
  }),
});

const EMAIL_FROM_ADDRESS = "lpulgar@bioalergia.cl";
const PDF_FILENAME = "resumen_honorarios.pdf";

function buildTimesheetEmailHtml({
  employeeName,
  month,
  monthLabel,
  summary,
}: {
  employeeName: string;
  month: string;
  monthLabel: string;
  summary: {
    role: string;
    subtotal: number;
    retention: number;
    net: number;
    payDate: string;
    workedMinutes?: number;
    overtimeMinutes?: number;
    retentionRate?: number;
    retention_rate?: number;
  };
}) {
  const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;

  const boletaDescription = `SERVICIOS PROFESIONALES DE ${summary.role.toUpperCase()} - PERIODO ${monthLabel.toUpperCase()} - TIEMPO FACTURABLE ${totalHoursFormatted}`;

  const fmtCLP = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const summaryYear = month
    ? Number.parseInt(month.split("-")[0] ?? "2024", 10)
    : new Date().getFullYear();
  const employeeRate = summary.retentionRate || summary.retention_rate || null;
  const effectiveRate = employeeRate ?? (summaryYear >= 2024 ? 0.1275 : 0.1);
  const retentionPercent = `${(effectiveRate * 100).toFixed(2)}%`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .boleta-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .boleta-box h3 { color: #065f46; font-size: 12px; text-transform: uppercase; margin: 0 0 12px 0; }
    .boleta-box .description { font-family: monospace; font-weight: bold; font-size: 14px; color: #065f46; margin-bottom: 12px; }
    .boleta-box .amount { font-family: monospace; font-weight: bold; font-size: 24px; color: #065f46; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; }
    th { background: #e5e7eb; color: #4b5563; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .total-row { background: #1e40af; color: white; font-weight: bold; }
    .info-box { border: 1px solid #f59e0b; background: #fef3c7; padding: 12px; border-radius: 8px; margin: 16px 0; text-align: center; color: #92400e; }
    .attachment-box { border: 1px solid #0ea5e9; background: #e0f2fe; padding: 12px; border-radius: 8px; margin: 16px 0; color: #075985; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Boleta de Honorarios - ${monthLabel}</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Prestación de servicios profesionales a honorarios</p>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${employeeName}</strong>,</p>
      <p>Junto con saludar, comparto el resumen de prestaciones de servicios profesionales a honorarios correspondientes al periodo <strong>${monthLabel}</strong>, para su revisión.</p>
      <p>Si está conforme, agradeceré emitir la Boleta de Honorarios Electrónica (BHE) por el monto bruto indicado, considerando la retención vigente según corresponda en la emisión.</p>
      
      <div class="boleta-box">
        <h3>🧾 Datos para emitir BHE</h3>
        <div>
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #065f46;">Descripción sugerida:</p>
          <p class="description">${boletaDescription}</p>
        </div>
        <div>
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #065f46;">Monto bruto honorarios:</p>
          <p class="amount">${fmtCLP(summary.subtotal)}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th style="text-align: right;">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tiempo total facturable</td>
            <td style="text-align: right; font-family: monospace;">${totalHoursFormatted}</td>
          </tr>
          <tr>
            <td>Monto bruto de honorarios</td>
            <td style="text-align: right; font-family: monospace;">${fmtCLP(summary.subtotal)}</td>
          </tr>
          <tr>
            <td>Retención (${retentionPercent})</td>
            <td style="text-align: right; font-family: monospace;">-${fmtCLP(summary.retention)}</td>
          </tr>
          <tr class="total-row">
            <td>Líquido estimado</td>
            <td style="text-align: right; font-family: monospace;">${fmtCLP(summary.net)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="info-box">
        <strong>📅 Fecha estimada de pago/transferencia de honorarios: ${summary.payDate}</strong>
      </div>
      
      <div class="attachment-box">
        <strong>📎 Adjunto:</strong> Documento PDF con el detalle del periodo para respaldo y conciliación.
      </div>
      <p style="font-size: 12px; color: #4b5563;">Nota: El detalle de tramos horarios se incluye únicamente para fines de respaldo/conciliación de honorarios y no constituye control de jornada ni implica subordinación o dependencia.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

function buildTimesheetEmailPayload({
  employeeEmail,
  employeeName,
  month,
  monthLabel,
  pdfBase64,
  summary,
}: {
  employeeEmail: string;
  employeeName: string;
  month: string;
  monthLabel: string;
  pdfBase64: string;
  summary: {
    role: string;
    subtotal: number;
    retention: number;
    net: number;
    payDate: string;
    workedMinutes?: number;
    overtimeMinutes?: number;
    retentionRate?: number;
    retention_rate?: number;
  };
}) {
  const htmlBody = buildTimesheetEmailHtml({ employeeName, month, monthLabel, summary });
  return {
    to: employeeEmail,
    from: EMAIL_FROM_ADDRESS,
    subject: `Boleta de Honorarios - ${monthLabel} - ${employeeName}`,
    html: htmlBody,
    attachments: [
      {
        filename: PDF_FILENAME,
        contentBase64: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  };
}

function buildEmlFromPayload(payload: ReturnType<typeof buildTimesheetEmailPayload>) {
  const boundary = `----=_Part_${Date.now()}`;
  return [
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    `Subject: ${payload.subject}`,
    `From: ${payload.from}`,
    `To: ${payload.to}`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    payload.html,
    ``,
    `--${boundary}`,
    `Content-Type: ${payload.attachments[0].contentType}; name="${payload.attachments[0].filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${payload.attachments[0].filename}"`,
    ``,
    payload.attachments[0].contentBase64,
    `--${boundary}--`,
  ].join("\r\n");
}

// ============================================================
// ROUTES
// ============================================================

// GET /summary - Get monthly summary for all employees or filtered
app.get("/summary", zValidator("query", monthQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { month = dayjs.tz(TIMEZONE).format("YYYY-MM"), employeeId } = c.req.valid("query");

    // Parse month to get date range using timezone
    const from = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
    const to = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");

    const summary = await buildMonthlySummary(from, to, employeeId);

    return reply(c, {
      status: "ok",
      month,
      from,
      to,
      ...summary,
    });
  } catch (error) {
    console.error("[timesheets] summary error:", error);
    return reply(c, { status: "error", message: "Error al cargar resumen" }, 500);
  }
});

// GET /salary-summary - Get salary data for temporal reports
app.get("/salary-summary", zValidator("query", salarySummaryQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canReadReport = await hasPermission(user.id, "read", "Report");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");

  if (!canReadReport && !canReadAudit && !canReadList) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { from: rawFrom, to: rawTo, employeeIds: rawIds } = c.req.valid("query");
    const employeeIds = rawIds?.split(",").map(Number) || [];

    let from: string;
    let to: string;

    if (!rawFrom && !rawTo) {
      // Auto-detect full historical range
      const dateRange = await getHistoricalDateRange();
      from = dateRange.from;
      to = dateRange.to;
    } else {
      // Use provided dates or defaults
      const defaults = defaultRangeQuery({ from: rawFrom, to: rawTo });
      from = defaults.from;
      to = defaults.to;
    }

    // Build salary summary data for all employees
    const data = await buildSalarySummaryData(from, to, employeeIds);

    return reply(c, {
      status: "ok",
      from,
      to,
      data,
    });
  } catch (error) {
    console.error("[timesheets] salary-summary error:", error);
    return reply(c, { status: "error", message: "Error al cargar resumen de salarios" }, 500);
  }
});

// GET / - List all timesheets (Global Range for Reports)
app.get("/", zValidator("query", rangeQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { from, to } = defaultRangeQuery(c.req.valid("query"));
    const entries = await listTimesheetEntries({ from, to });
    return reply(c, { status: "ok", entries });
  } catch (error) {
    console.error("[timesheets] list error:", error);
    return reply(c, { status: "error", message: "Error al listar registros" }, 500);
  }
});

// GET /months - Get available months
app.get("/months", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    // Generate last 24 months as available options
    const months: string[] = [];
    const today = dayjs();
    for (let i = 0; i < 24; i++) {
      months.push(today.subtract(i, "month").format("YYYY-MM"));
    }

    const monthsWithData: string[] = [];

    return reply(c, {
      status: "ok",
      months,
      monthsWithData,
    });
  } catch (error) {
    console.error("[timesheets] months error:", error);
    return reply(c, { status: "error", message: "Error al cargar meses" }, 500);
  }
});

// GET /multi-month - Get timesheets for multiple employees across multiple months
app.get("/multi-month", zValidator("query", multiMonthQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { employeeIds: rawIds, startMonth, endMonth } = c.req.valid("query");
    const employeeIds = rawIds?.split(",").map(Number) || [];
    const start = startMonth || dayjs.tz(TIMEZONE).format("YYYY-MM");
    const end = endMonth || start;

    const from = dayjs.tz(start, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
    const to = dayjs.tz(end, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");

    // Get entries for all requested employees
    const data: Record<
      string,
      {
        month: string;
        entries: Awaited<ReturnType<typeof listTimesheetEntries>>;
      }
    > = {};

    for (const employeeId of employeeIds) {
      const entries = await listTimesheetEntries({
        employee_id: employeeId,
        from,
        to,
      });
      data[String(employeeId)] = { month: start, entries };
    }

    return reply(c, { status: "ok", data });
  } catch (error) {
    console.error("[timesheets] multi-month error:", error);
    return reply(c, { status: "error", message: "Error al cargar datos multi-mes" }, 500);
  }
});

// GET /multi-detail - Get timesheet entries for multiple employees in a date range
app.get("/multi-detail", zValidator("query", multiDetailQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { employeeIds: rawIds, from: rawFrom, to: rawTo } = c.req.valid("query");
    const employeeIds = rawIds?.split(",").map(Number) || [];
    const { from, to } = defaultRangeQuery({ from: rawFrom, to: rawTo });

    const allEntries: Array<
      Awaited<ReturnType<typeof listTimesheetEntries>>[number] & {
        full_name?: string;
        employee_name?: string;
        employee_role?: string | null;
      }
    > = [];

    for (const employeeId of employeeIds) {
      const [employee, entries] = await Promise.all([
        getEmployeeById(employeeId),
        listTimesheetEntries({
          employee_id: employeeId,
          from,
          to,
        }),
      ]);

      const entriesWithName = entries.map((entry: TimesheetEntry) => ({
        ...entry,
        employee_name: employee?.person?.names || "Desconocido",
        employee_role: employee?.position || null,
        full_name: employee?.person?.names,
      }));

      allEntries.push(...entriesWithName);
    }

    return reply(c, { entries: allEntries });
  } catch (error) {
    console.error("[timesheets] multi-detail error:", error);
    return reply(c, { status: "error", message: "Error al cargar detalles" }, 500);
  }
});

// GET /:employeeId/range - Get timesheet entries for an employee in a date range
app.get(
  "/:employeeId/range",
  zValidator("param", employeeIdParamSchema),
  zValidator("query", rangeParamQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "Timesheet");
    const canReadList = await hasPermission(user.id, "read", "TimesheetList");
    const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
    const canReadReport = await hasPermission(user.id, "read", "Report");

    if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { employeeId } = c.req.valid("param");
      const { startDate: rawStart, endDate: rawEnd } = c.req.valid("query");

      const startDate = rawStart || dayjs.tz(TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const endDate = rawEnd || dayjs.tz(TIMEZONE).endOf("month").format("YYYY-MM-DD");

      const entries = await listTimesheetEntries({
        employee_id: employeeId,
        from: startDate,
        to: endDate,
      });

      return reply(c, {
        status: "ok",
        entries,
        from: startDate,
        to: endDate,
      });
    } catch (error) {
      console.error("[timesheets] range error:", error);
      return reply(c, { status: "error", message: "Error al cargar rango" }, 500);
    }
  },
);

// GET /:employeeId/detail - Get detailed timesheet entries for an employee
app.get(
  "/:employeeId/detail",
  zValidator("param", employeeIdParamSchema),
  zValidator("query", detailMonthQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "Unauthorized" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "Timesheet");
    const canReadList = await hasPermission(user.id, "read", "TimesheetList");
    const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
    const canReadReport = await hasPermission(user.id, "read", "Report");

    if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    try {
      const { employeeId } = c.req.valid("param");
      const { month: rawMonth } = c.req.valid("query");
      const month = rawMonth || dayjs.tz(TIMEZONE).format("YYYY-MM");

      const from = dayjs.tz(month, "YYYY-MM", TIMEZONE).startOf("month").format("YYYY-MM-DD");
      const to = dayjs.tz(month, "YYYY-MM", TIMEZONE).endOf("month").format("YYYY-MM-DD");

      const entries = await listTimesheetEntries({
        employee_id: employeeId,
        from,
        to,
      });

      return reply(c, {
        status: "ok",
        entries,
        from,
        to,
      });
    } catch (error) {
      console.error("[timesheets] detail error:", error);
      return reply(c, { status: "error", message: "Error al cargar detalle" }, 500);
    }
  },
);

// POST / - Create or update timesheet entry
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "Timesheet");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const body = await c.req.json();
    const normalized = normalizeTimesheetPayload(body);
    const entry = await upsertTimesheetEntry(normalized as UpsertTimesheetPayload);
    return reply(c, { status: "ok", entry });
  } catch (error) {
    console.error("[timesheets] create error:", error);
    const message = error instanceof Error ? error.message : "Error al guardar registro";
    return reply(c, { status: "error", message }, 500);
  }
});

// POST /bulk - Bulk upsert timesheet entries
app.post("/bulk", zValidator("json", bulkBodySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "Timesheet");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { employee_id, entries, remove_ids } = c.req.valid("json");

    let inserted = 0;
    let removed = 0;

    // Delete entries
    for (const id of remove_ids) {
      await deleteTimesheetEntry(Number(id));
      removed++;
    }

    // Upsert entries
    for (const entry of entries) {
      const normalized = normalizeTimesheetPayload({
        employee_id,
        ...entry,
      });
      await upsertTimesheetEntry(normalized as UpsertTimesheetPayload);
      inserted++;
    }

    return reply(c, { status: "ok", inserted, removed });
  } catch (error) {
    console.error("[timesheets] bulk error:", error);
    const message = error instanceof Error ? error.message : "Error al procesar registros";
    return reply(c, { status: "error", message }, 500);
  }
});

// PUT /:id - Update timesheet entry
app.put("/:id", zValidator("param", idParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Timesheet");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id } = c.req.valid("param");

  try {
    const body = await c.req.json(); // Use partial schema or explicit validation if strictly required, simplified for PUT
    const entry = await updateTimesheetEntry(id, body);
    return reply(c, { status: "ok", entry });
  } catch (error) {
    console.error("[timesheets] update error:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar registro";
    return reply(c, { status: "error", message }, 500);
  }
});

// DELETE /:id - Delete timesheet entry
app.delete("/:id", zValidator("param", idParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canDelete = await hasPermission(user.id, "delete", "Timesheet");
  if (!canDelete) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id } = c.req.valid("param");

  try {
    await deleteTimesheetEntry(id);
    return reply(c, { status: "ok" });
  } catch (error) {
    console.error("[timesheets] delete error:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar registro";
    return reply(c, { status: "error", message }, 500);
  }
});

// POST /prepare-email-payload - Prepare payload for local mail agent
app.post("/prepare-email-payload", zValidator("json", emailBodySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { month, monthLabel, pdfBase64, employeeName, employeeEmail, summary } =
      c.req.valid("json");

    const payload = buildTimesheetEmailPayload({
      employeeEmail,
      employeeName,
      month,
      monthLabel,
      pdfBase64,
      summary,
    });

    return reply(c, { status: "ok", payload });
  } catch (error) {
    console.error("[timesheets] prepare-email-payload error:", error);
    return reply(c, { status: "error", message: "Error al preparar el email" }, 500);
  }
});

// POST /prepare-email - Prepare email with PDF attachment (legacy .eml)
app.post("/prepare-email", zValidator("json", emailBodySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const { employeeId, month, monthLabel, pdfBase64, employeeName, employeeEmail, summary } =
      c.req.valid("json");

    const filename = `resumen_honorarios_${month}_${employeeId}.eml`;
    const payload = buildTimesheetEmailPayload({
      employeeEmail,
      employeeName,
      month,
      monthLabel,
      pdfBase64,
      summary,
    });

    const emlBase64 = Buffer.from(buildEmlFromPayload(payload)).toString("base64");

    return reply(c, {
      status: "ok",
      emlBase64,
      filename,
    });
  } catch (error) {
    console.error("[timesheets] prepare-email error:", error);
    return reply(c, { status: "error", message: "Error al preparar el email" }, 500);
  }
});

export const timesheetRoutes = app;
