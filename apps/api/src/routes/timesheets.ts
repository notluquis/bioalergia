import { Hono } from "hono";
import { getSessionUser } from "../auth";
import dayjs from "dayjs";
import {
  buildMonthlySummary,
  listTimesheetEntries,
  upsertTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  normalizeTimesheetPayload,
  type UpsertTimesheetPayload,
} from "../services/timesheets";

const app = new Hono();

// GET /summary - Get monthly summary for all employees or filtered
app.get("/summary", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const query = c.req.query();
    const month = query.month || dayjs().format("YYYY-MM");
    const employeeId = query.employeeId ? Number(query.employeeId) : undefined;

    // Parse month to get date range
    const from = dayjs(month).startOf("month").format("YYYY-MM-DD");
    const to = dayjs(month).endOf("month").format("YYYY-MM-DD");

    const summary = await buildMonthlySummary(from, to, employeeId);

    return c.json({
      status: "ok",
      month,
      from,
      to,
      ...summary,
    });
  } catch (error) {
    console.error("[timesheets] summary error:", error);
    return c.json({ status: "error", message: "Error al cargar resumen" }, 500);
  }
});

// GET /months - Get available months
app.get("/months", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    // Generate last 24 months as available options
    const months: string[] = [];
    const today = dayjs();
    for (let i = 0; i < 24; i++) {
      months.push(today.subtract(i, "month").format("YYYY-MM"));
    }

    // TODO: Query DB to find which months actually have data
    const monthsWithData: string[] = [];

    return c.json({
      status: "ok",
      months,
      monthsWithData,
    });
  } catch (error) {
    console.error("[timesheets] months error:", error);
    return c.json({ status: "error", message: "Error al cargar meses" }, 500);
  }
});

// GET /multi-month - Get timesheets for multiple employees across multiple months
app.get("/multi-month", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

    return c.json({ status: "ok", data });
  } catch (error) {
    console.error("[timesheets] multi-month error:", error);
    return c.json(
      { status: "error", message: "Error al cargar datos multi-mes" },
      500
    );
  }
});

// GET /multi-detail - Get timesheet entries for multiple employees in a date range
app.get("/multi-detail", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

    return c.json({ entries: allEntries });
  } catch (error) {
    console.error("[timesheets] multi-detail error:", error);
    return c.json(
      { status: "error", message: "Error al cargar detalles" },
      500
    );
  }
});

// GET /:employeeId/range - Get timesheet entries for an employee in a date range
app.get("/:employeeId/range", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const employeeId = Number(c.req.param("employeeId"));
    if (!Number.isFinite(employeeId)) {
      return c.json({ status: "error", message: "ID inválido" }, 400);
    }

    const query = c.req.query();
    const startDate =
      query.startDate || dayjs().startOf("month").format("YYYY-MM-DD");
    const endDate =
      query.endDate || dayjs().endOf("month").format("YYYY-MM-DD");

    const entries = await listTimesheetEntries({
      employee_id: employeeId,
      from: startDate,
      to: endDate,
    });

    return c.json({
      status: "ok",
      entries,
      from: startDate,
      to: endDate,
    });
  } catch (error) {
    console.error("[timesheets] range error:", error);
    return c.json({ status: "error", message: "Error al cargar rango" }, 500);
  }
});

// GET /:employeeId/detail - Get detailed timesheet entries for an employee
app.get("/:employeeId/detail", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const employeeId = Number(c.req.param("employeeId"));
    if (!Number.isFinite(employeeId)) {
      return c.json({ status: "error", message: "ID inválido" }, 400);
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

    return c.json({
      status: "ok",
      entries,
      from,
      to,
    });
  } catch (error) {
    console.error("[timesheets] detail error:", error);
    return c.json({ status: "error", message: "Error al cargar detalle" }, 500);
  }
});

// POST / - Create or update timesheet entry
app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const normalized = normalizeTimesheetPayload(body);
    const entry = await upsertTimesheetEntry(
      normalized as UpsertTimesheetPayload
    );
    return c.json({ status: "ok", entry });
  } catch (error) {
    console.error("[timesheets] create error:", error);
    const message =
      error instanceof Error ? error.message : "Error al guardar registro";
    return c.json({ status: "error", message }, 500);
  }
});

// POST /bulk - Bulk upsert timesheet entries
app.post("/bulk", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

    return c.json({ status: "ok", inserted, removed });
  } catch (error) {
    console.error("[timesheets] bulk error:", error);
    const message =
      error instanceof Error ? error.message : "Error al procesar registros";
    return c.json({ status: "error", message }, 500);
  }
});

// PUT /:id - Update timesheet entry
app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  try {
    const body = await c.req.json();
    const entry = await updateTimesheetEntry(id, body);
    return c.json({ status: "ok", entry });
  } catch (error) {
    console.error("[timesheets] update error:", error);
    const message =
      error instanceof Error ? error.message : "Error al actualizar registro";
    return c.json({ status: "error", message }, 500);
  }
});

// DELETE /:id - Delete timesheet entry
app.delete("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  try {
    await deleteTimesheetEntry(id);
    return c.json({ status: "ok" });
  } catch (error) {
    console.error("[timesheets] delete error:", error);
    const message =
      error instanceof Error ? error.message : "Error al eliminar registro";
    return c.json({ status: "error", message }, 500);
  }
});

// POST /prepare-email - Prepare email with PDF attachment
app.post("/prepare-email", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const { employeeId, month, monthLabel, pdfBase64 } = body;

    // Convert PDF to .eml format for download
    const filename = `liquidacion_${month}_${employeeId}.eml`;

    // Create simple EML with attachment
    const boundary = "----=_Part_" + Date.now();
    const emlContent = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      `Subject: Liquidación ${monthLabel}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Adjunto encontrarás tu liquidación correspondiente a ${monthLabel}.`,
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

    return c.json({
      status: "ok",
      emlBase64,
      filename,
    });
  } catch (error) {
    console.error("[timesheets] prepare-email error:", error);
    return c.json(
      { status: "error", message: "Error al preparar el email" },
      500
    );
  }
});

export default app;
