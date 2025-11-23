import express from "express";
import { z } from "zod";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { Prisma, Employee } from "../../generated/prisma/client.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { listEmployees, getEmployeeById } from "../services/employees.js";
import {
  listTimesheetEntries,
  upsertTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
} from "../services/timesheets.js";
import { timesheetPayloadSchema, timesheetUpdateSchema, timesheetBulkSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";
import { durationToMinutes, minutesToDuration } from "../../shared/time.js";
import { roundCurrency } from "../../shared/currency.js";
import { prisma } from "../prisma.js";
import { formatDateOnly } from "../lib/time.js";

const monthParamSchema = z.object({
  month: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}$/)
    .optional()
    .transform((value) => value ?? formatMonth(new Date())),
});

export function registerTimesheetRoutes(app: express.Express) {
  // Endpoint para obtener meses registrados
  app.get(
    "/api/timesheets/months",
    authenticate,
    asyncHandler(async (_req, res) => {
      // Generar lista de meses disponibles: 6 meses atrás hasta 3 meses adelante
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const availableMonths = Array.from({ length: 10 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      });

      // Consultar qué meses tienen datos reales usando Prisma
      const entries = await prisma.employeeTimesheet.findMany({
        select: { workDate: true },
        distinct: ["workDate"],
        orderBy: { workDate: "desc" },
      });

      const monthsWithData = new Set(
        entries
          .map((e: { workDate: Date }) => formatDateOnly(e.workDate).slice(0, 7)) // YYYY-MM
          .filter(Boolean)
      );

      res.json({
        status: "ok",
        months: availableMonths,
        monthsWithData: Array.from(monthsWithData),
      });
    })
  );

  app.get(
    "/api/timesheets",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = z
        .object({
          employeeId: z.coerce.number().int().positive().optional(),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(req.query);

      const entries = await listTimesheetEntries({
        employee_id: parsed.employeeId,
        from: parsed.from,
        to: parsed.to,
      });
      logEvent("timesheets:list", requestContext(req, { count: entries.length }));
      res.json({ status: "ok", entries });
    })
  );

  app.post(
    "/api/timesheets",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = timesheetPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("timesheets:create:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      const payload = normalizeTimesheetPayload(parsed.data);
      const entry = await upsertTimesheetEntry(payload);
      logEvent(
        "timesheets:upsert",
        requestContext(req, { employeeId: payload.employee_id, workDate: payload.work_date })
      );
      res.status(201).json({ status: "ok", entry });
    })
  );

  app.put(
    "/api/timesheets/:id",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = timesheetUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("timesheets:update:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }
      const id = Number(req.params.id);
      const updatePayload: Parameters<typeof updateTimesheetEntry>[1] = {};

      if (parsed.data.start_time !== undefined) {
        updatePayload.start_time = parsed.data.start_time;
      }
      if (parsed.data.end_time !== undefined) {
        updatePayload.end_time = parsed.data.end_time;
      }

      let workedMinutes = parsed.data.worked_minutes;
      if (workedMinutes == null && parsed.data.start_time != null && parsed.data.end_time != null) {
        const start = durationToMinutes(parsed.data.start_time);
        const end = durationToMinutes(parsed.data.end_time);
        workedMinutes = Math.max(end - start, 0);
      }
      if (workedMinutes != null) {
        updatePayload.worked_minutes = workedMinutes;
      }
      if (parsed.data.overtime_minutes != null) {
        updatePayload.overtime_minutes = parsed.data.overtime_minutes;
      }
      if (parsed.data.extra_amount != null) {
        updatePayload.extra_amount = parsed.data.extra_amount;
      }
      if (parsed.data.comment !== undefined) {
        updatePayload.comment = parsed.data.comment;
      }

      const entry = await updateTimesheetEntry(id, updatePayload);
      logEvent("timesheets:update", requestContext(req, { id }));
      res.json({ status: "ok", entry });
    })
  );

  app.delete(
    "/api/timesheets/:id",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      await deleteTimesheetEntry(id);
      logEvent("timesheets:delete", requestContext(req, { id }));
      res.json({ status: "ok" });
    })
  );

  app.post(
    "/api/timesheets/bulk",
    authenticate,
    requireRole("GOD", "ADMIN", "ANALYST"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = timesheetBulkSchema.parse(req.body ?? {});
      const employee = await getEmployeeById(parsed.employee_id);
      if (!employee) {
        return res.status(404).json({ status: "error", message: "No se ha encontrado al trabajador" });
      }

      for (const entry of parsed.entries) {
        await upsertTimesheetEntry({
          employee_id: parsed.employee_id,
          work_date: entry.work_date,
          start_time: entry.start_time ?? null,
          end_time: entry.end_time ?? null,
          overtime_minutes: entry.overtime_minutes ?? 0,
          extra_amount: entry.extra_amount ?? 0,
          comment: entry.comment ?? null,
        });
      }

      if (parsed.remove_ids?.length) {
        for (const id of parsed.remove_ids) {
          await deleteTimesheetEntry(id);
        }
      }

      logEvent(
        "timesheets:bulk",
        requestContext(req, {
          employeeId: parsed.employee_id,
          entries: parsed.entries.length,
          removed: parsed.remove_ids?.length ?? 0,
        })
      );

      res.json({
        status: "ok",
        inserted: parsed.entries.length,
        removed: parsed.remove_ids?.length ?? 0,
      });
    })
  );

  app.get(
    "/api/timesheets/summary",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { month } = monthParamSchema.parse(req.query);
      const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
      const { from, to } = getMonthRange(month);
      const summary = await buildMonthlySummary(from, to, employeeId);
      logEvent("timesheets:summary", requestContext(req, { month, employeeId, employees: summary.employees.length }));
      res.json({ status: "ok", month, from, to, ...summary });
    })
  );

  app.get(
    "/api/timesheets/:employeeId/detail",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { month } = monthParamSchema.parse(req.query);
      const employeeId = Number(req.params.employeeId);
      const { from, to } = getMonthRange(month);
      const entries = await listTimesheetEntries({ employee_id: employeeId, from, to });
      logEvent("timesheets:detail", requestContext(req, { month, employeeId, count: entries.length }));
      res.json({ status: "ok", month, from, to, entries });
    })
  );

  // Multi-employee endpoint for audit calendar
  // Only returns entries with both start_time and end_time
  app.get(
    "/api/timesheets/multi-detail",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const employeeIdsParam = req.query.employeeIds as string;
      const from = req.query.from as string;
      const to = req.query.to as string;

      if (!employeeIdsParam || !from || !to) {
        return res.status(400).json({
          status: "error",
          message: "Missing required parameters: employeeIds, from, to",
        });
      }

      const employeeIds = employeeIdsParam
        .split(",")
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));

      if (employeeIds.length === 0) {
        return res.json({ status: "ok", entries: [] });
      }

      // Limit to 5 employees for performance
      if (employeeIds.length > 5) {
        return res.status(400).json({
          status: "error",
          message: "Maximum 5 employees can be audited at once",
        });
      }

      const employees = await listEmployees();
      const employeeNameMap = new Map(employees.map((emp: { id: number; fullName: string }) => [emp.id, emp.fullName]));
      const employeeRoleMap = new Map(
        employees.map((emp: { id: number; role: string | null }) => [emp.id, emp.role ?? null])
      );

      // Query entries with start_time AND end_time only using Prisma
      const rawEntries = await prisma.employeeTimesheet.findMany({
        where: {
          employeeId: { in: employeeIds },
          workDate: {
            gte: new Date(from),
            lte: new Date(to),
          },
          startTime: { not: null },
          endTime: { not: null },
        },
        orderBy: [{ workDate: "asc" }, { employeeId: "asc" }],
      });

      const entries = rawEntries.map((row: Prisma.EmployeeTimesheetGetPayload<{}>) => ({
        id: Number(row.id),
        employee_id: row.employeeId,
        employee_name: employeeNameMap.get(row.employeeId) || `Employee #${row.employeeId}`,
        employee_role: employeeRoleMap.get(row.employeeId) ?? null,
        work_date: formatDateOnly(row.workDate),
        start_time: row.startTime ? String(row.startTime).slice(0, 5) : null,
        end_time: row.endTime ? String(row.endTime).slice(0, 5) : null,
        worked_minutes: row.workedMinutes,
        overtime_minutes: row.overtimeMinutes,
        comment: row.comment,
      }));

      logEvent(
        "timesheets:multi-detail",
        requestContext(req, {
          employeeIds,
          from,
          to,
          entries_count: entries.length,
        })
      );

      res.json({ status: "ok", entries });
    })
  );
}

function normalizeTimesheetPayload(data: {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes?: number;
  overtime_minutes?: number;
  extra_amount?: number;
  comment?: string | null;
}) {
  let workedMinutes = data.worked_minutes ?? 0;
  const overtimeMinutes = data.overtime_minutes ?? 0;
  const extraAmount = data.extra_amount ?? 0;

  if (!workedMinutes && data.start_time && data.end_time) {
    const start = durationToMinutes(data.start_time);
    const end = durationToMinutes(data.end_time);
    workedMinutes = Math.max(end - start, 0);
  }

  return {
    employee_id: data.employee_id,
    work_date: data.work_date,
    start_time: data.start_time ?? null,
    end_time: data.end_time ?? null,
    worked_minutes: workedMinutes,
    overtime_minutes: overtimeMinutes,
    extra_amount: extraAmount,
    comment: data.comment ?? null,
  };
}

async function buildMonthlySummary(from: string, to: string, employeeId?: number) {
  const employees = await listEmployees();
  const employeeMap = new Map(employees.map((employee: Employee) => [employee.id, employee]));

  // Use Prisma groupBy instead of MySQL
  const summaryData = await prisma.employeeTimesheet.groupBy({
    by: ["employeeId"],
    where: {
      workDate: {
        gte: new Date(from),
        lte: new Date(to),
      },
      ...(employeeId && { employeeId }),
    },
    _sum: {
      workedMinutes: true,
      overtimeMinutes: true,
      extraAmount: true,
    },
  });

  const results: Array<ReturnType<typeof buildEmployeeSummary>> = [];
  let totals = {
    workedMinutes: 0,
    overtimeMinutes: 0,
    extraAmount: 0,
    subtotal: 0,
    retention: 0,
    net: 0,
  };

  for (const row of summaryData) {
    const employee = employeeMap.get(row.employeeId);
    if (!employee) continue;
    const summary = buildEmployeeSummary(employee, {
      workedMinutes: Number(row._sum.workedMinutes ?? 0),
      overtimeMinutes: Number(row._sum.overtimeMinutes ?? 0),
      extraAmount: Number(row._sum.extraAmount ?? 0),
      periodStart: from,
    });
    results.push(summary);
    totals.workedMinutes += summary.workedMinutes;
    totals.overtimeMinutes += summary.overtimeMinutes;
    totals.extraAmount += summary.extraAmount;
    totals.subtotal += summary.subtotal;
    totals.retention += summary.retention;
    totals.net += summary.net;
  }

  // Si se filtró por empleado específico pero no tiene datos, incluirlo con 0s
  if (employeeId && results.length === 0) {
    const employee = employeeMap.get(employeeId);
    if (employee) {
      const summary = buildEmployeeSummary(employee, {
        workedMinutes: 0,
        overtimeMinutes: 0,
        extraAmount: 0,
        periodStart: from,
      });
      results.push(summary);
    }
  }

  results.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    employees: results,
    totals: {
      hours: minutesToDuration(totals.workedMinutes),
      overtime: minutesToDuration(totals.overtimeMinutes),
      extraAmount: roundCurrency(totals.extraAmount),
      subtotal: roundCurrency(totals.subtotal),
      retention: roundCurrency(totals.retention),
      net: roundCurrency(totals.net),
    },
  };
}

function buildEmployeeSummary(
  employee: Awaited<ReturnType<typeof getEmployeeById>>,
  data: {
    workedMinutes: number;
    overtimeMinutes: number;
    extraAmount: number;
    periodStart: string;
  }
) {
  const hourlyRate = Number(employee?.hourlyRate ?? 0);
  const overtimeRate = Number(employee?.overtimeRate ?? 0);
  const retentionRate = Number(employee?.retentionRate ?? 0);
  const basePay = roundCurrency((data.workedMinutes / 60) * hourlyRate);
  const overtimePay = roundCurrency((data.overtimeMinutes / 60) * overtimeRate);
  const extras = roundCurrency(data.extraAmount);
  const subtotal = roundCurrency(basePay + overtimePay + extras);
  const retention = roundCurrency(subtotal * retentionRate);
  const net = roundCurrency(subtotal - retention);
  const payDate = computePayDate(employee?.role ?? "", data.periodStart);

  return {
    employeeId: employee?.id ?? 0,
    fullName: employee?.fullName ?? "",
    role: employee?.role ?? "",
    email: employee?.email ?? null,
    workedMinutes: data.workedMinutes,
    overtimeMinutes: data.overtimeMinutes,
    extraAmount: extras,
    hourlyRate,
    overtimeRate,
    retentionRate,
    subtotal,
    retention,
    net,
    payDate,
    hoursFormatted: minutesToDuration(data.workedMinutes),
    overtimeFormatted: minutesToDuration(data.overtimeMinutes),
  };
}

function computePayDate(role: string, periodStart: string) {
  const startDate = new Date(periodStart);
  const nextMonthFirstDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  if (role.toUpperCase().includes("ENFER")) {
    // Enfermeros: 5to día hábil del mes siguiente
    return formatDate(getNthBusinessDay(nextMonthFirstDay, 5));
  }
  // Otros: día 5 calendario del mes siguiente
  return formatDate(new Date(nextMonthFirstDay.getFullYear(), nextMonthFirstDay.getMonth(), 5));
}

function getNthBusinessDay(base: Date, n: number) {
  const date = new Date(base);
  let count = 0;
  while (count < n) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === n) break;
    }
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthRange(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const fromDate = new Date(year, monthIndex, 1);
  const toDate = new Date(year, monthIndex + 1, 0);
  return {
    from: formatDate(fromDate),
    to: formatDate(toDate),
  };
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
