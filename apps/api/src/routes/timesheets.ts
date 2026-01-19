import dayjs from "dayjs";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  buildMonthlySummary,
  deleteTimesheetEntry,
  listTimesheetEntries,
  normalizeTimesheetPayload,
  type UpsertTimesheetPayload,
  updateTimesheetEntry,
  upsertTimesheetEntry,
} from "../services/timesheets";
import { reply } from "../utils/reply";

const app = new Hono();

// GET /summary - Get monthly summary for all employees or filtered
app.get("/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const query = c.req.query();
    const month = query.month || dayjs().format("YYYY-MM");
    const employeeId = query.employeeId ? Number(query.employeeId) : undefined;

    // Parse month to get date range
    const from = dayjs(month).startOf("month").format("YYYY-MM-DD");
    const to = dayjs(month).endOf("month").format("YYYY-MM-DD");

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

// GET / - List all timesheets (Global Range for Reports)
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const query = c.req.query();
    const from = query.from || dayjs().startOf("month").format("YYYY-MM-DD");
    const to = query.to || dayjs().endOf("month").format("YYYY-MM-DD");

    const entries = await listTimesheetEntries({ from, to });

    return reply(c, { status: "ok", entries });
  } catch (error) {
    console.error("[timesheets] list error:", error);
    return reply(c, { status: "error", message: "Error al listar registros" }, 500);
  }
});

// Explicit match for empty path to handle /api/timesheets without trailing slash strictness
app.get("", async (c) => {
  // Reuse the logic from "/"
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const query = c.req.query();
    const from = query.from || dayjs().startOf("month").format("YYYY-MM-DD");
    const to = query.to || dayjs().endOf("month").format("YYYY-MM-DD");

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
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

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

    // TODO: Query DB to find which months actually have data
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
app.get("/multi-month", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const query = c.req.query();
    const employeeIds = query.employeeIds?.split(",").map(Number) || [];
    const startMonth = query.startMonth || dayjs().format("YYYY-MM");
    const endMonth = query.endMonth || startMonth;

    const from = dayjs(startMonth).startOf("month").format("YYYY-MM-DD");
    const to = dayjs(endMonth).endOf("month").format("YYYY-MM-DD");

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
      data[String(employeeId)] = { month: startMonth, entries };
    }

    return reply(c, { status: "ok", data });
  } catch (error) {
    console.error("[timesheets] multi-month error:", error);
    return reply(c, { status: "error", message: "Error al cargar datos multi-mes" }, 500);
  }
});

// GET /multi-detail - Get timesheet entries for multiple employees in a date range
app.get("/multi-detail", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const query = c.req.query();
    const employeeIds = query.employeeIds?.split(",").map(Number) || [];
    const from = query.from || dayjs().startOf("month").format("YYYY-MM-DD");
    const to = query.to || dayjs().endOf("month").format("YYYY-MM-DD");

    // Collect entries for all employees
    const allEntries: Array<
      Awaited<ReturnType<typeof listTimesheetEntries>>[number] & {
        full_name?: string;
      }
    > = [];

    for (const employeeId of employeeIds) {
      const entries = await listTimesheetEntries({
        employee_id: employeeId,
        from,
        to,
      });
      allEntries.push(...entries);
    }

    return reply(c, { entries: allEntries });
  } catch (error) {
    console.error("[timesheets] multi-detail error:", error);
    return reply(c, { status: "error", message: "Error al cargar detalles" }, 500);
  }
});

// GET /:employeeId/range - Get timesheet entries for an employee in a date range
app.get("/:employeeId/range", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const employeeId = Number(c.req.param("employeeId"));
    if (!Number.isFinite(employeeId)) {
      return reply(c, { status: "error", message: "ID inválido" }, 400);
    }

    const query = c.req.query();
    const startDate = query.startDate || dayjs().startOf("month").format("YYYY-MM-DD");
    const endDate = query.endDate || dayjs().endOf("month").format("YYYY-MM-DD");

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
});

// GET /:employeeId/detail - Get detailed timesheet entries for an employee
app.get("/:employeeId/detail", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const employeeId = Number(c.req.param("employeeId"));
    if (!Number.isFinite(employeeId)) {
      return reply(c, { status: "error", message: "ID inválido" }, 400);
    }

    const query = c.req.query();
    const month = query.month || dayjs().format("YYYY-MM");

    const from = dayjs(month).startOf("month").format("YYYY-MM-DD");
    const to = dayjs(month).endOf("month").format("YYYY-MM-DD");

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
});

// POST / - Create or update timesheet entry
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Timesheet");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

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
app.post("/bulk", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Timesheet");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  try {
    const body = await c.req.json();
    const { employee_id, entries = [], remove_ids = [] } = body;

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
app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Timesheet");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  try {
    const body = await c.req.json();
    const entry = await updateTimesheetEntry(id, body);
    return reply(c, { status: "ok", entry });
  } catch (error) {
    console.error("[timesheets] update error:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar registro";
    return reply(c, { status: "error", message }, 500);
  }
});

// DELETE /:id - Delete timesheet entry
app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Timesheet");
  if (!canDelete) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  try {
    await deleteTimesheetEntry(id);
    return reply(c, { status: "ok" });
  } catch (error) {
    console.error("[timesheets] delete error:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar registro";
    return reply(c, { status: "error", message }, 500);
  }
});

// POST /prepare-email - Prepare email with PDF attachment
app.post("/prepare-email", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Timesheet");
  const canReadList = await hasPermission(user.id, "read", "TimesheetList");
  const canReadAudit = await hasPermission(user.id, "read", "TimesheetAudit");
  const canReadReport = await hasPermission(user.id, "read", "Report");

  if (!canRead && !canReadList && !canReadAudit && !canReadReport) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const body = await c.req.json();
    const { employeeId, month, monthLabel, pdfBase64, employeeName, employeeEmail, summary } = body;

    // Convert PDF to .eml format for download
    const filename = `liquidacion_${month}_${employeeId}.eml`;

    // Build HTML email body matching preview
    const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
    const totalHrs = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;
    const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;

    const boletaDescription = `SERVICIOS DE ${summary.role.toUpperCase()} ${totalHoursFormatted} HORAS`;

    // Format currency CLP
    const fmtCLP = (amount: number) => {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
      }).format(amount);
    };

    // Get retention rate
    const summaryYear = month ? parseInt(month.split("-")[0]!, 10) : new Date().getFullYear();
    const employeeRate = summary.retentionRate || summary.retention_rate || null;
    const effectiveRate = employeeRate ?? (summaryYear >= 2024 ? 0.1275 : 0.1);
    const retentionPercent = `${(effectiveRate * 100).toFixed(2)}%`;

    const htmlBody = `
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
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Servicios de ${summary.role}</p>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${employeeName}</strong>,</p>
      <p>A continuación encontrarás el resumen de los servicios prestados durante el periodo <strong>${monthLabel}</strong>, favor corroborar y emitir boleta de honorarios.</p>
      
      <div class="boleta-box">
        <h3>📝 Para la boleta de honorarios</h3>
        <div>
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #065f46;">Descripción:</p>
          <p class="description">${boletaDescription}</p>
        </div>
        <div>
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #065f46;">Monto Bruto:</p>
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
            <td>Horas totales</td>
            <td style="text-align: right; font-family: monospace;">${totalHoursFormatted}</td>
          </tr>
          <tr>
            <td>Monto Bruto</td>
            <td style="text-align: right; font-family: monospace;">${fmtCLP(summary.subtotal)}</td>
          </tr>
          <tr>
            <td>Retención (${retentionPercent})</td>
            <td style="text-align: right; font-family: monospace;">-${fmtCLP(summary.retention)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Líquido</td>
            <td style="text-align: right; font-family: monospace;">${fmtCLP(summary.net)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="info-box">
        <strong>📅 Fecha de pago estimada: ${summary.payDate}</strong>
      </div>
      
      <div class="attachment-box">
        <strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

    // Create EML with HTML content and attachment
    const boundary = `----=_Part_${Date.now()}`;
    const emlContent = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      `Subject: Boleta de Honorarios - ${monthLabel} - ${employeeName}`,
      `To: ${employeeEmail}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlBody,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="liquidacion.pdf"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="liquidacion.pdf"`,
      ``,
      pdfBase64,
      `--${boundary}--`,
    ].join("\r\n");

    const emlBase64 = Buffer.from(emlContent).toString("base64");

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

export default app;
