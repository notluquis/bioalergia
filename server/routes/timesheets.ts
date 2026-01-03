import { Prisma } from "@prisma/client";
import express from "express";

import { roundCurrency } from "../../shared/currency.js";
import { asyncHandler, authenticate } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { formatDateOnly, getMonthRange } from "../lib/time.js";
import { authorize } from "../middleware/authorize.js";
import { prisma } from "../prisma.js";
import {
  monthParamSchema,
  prepareEmailSchema,
  timesheetBulkSchema,
  timesheetListQuerySchema,
  timesheetPayloadSchema,
  timesheetUpdateSchema,
} from "../schemas/index.js";
import { generateTimesheetEml } from "../services/email.js";
import { getEmployeeById, listEmployees } from "../services/employees.js";
import {
  buildMonthlySummary,
  deleteTimesheetEntry,
  durationToMinutes,
  listTimesheetEntries,
  normalizeTimesheetPayload,
  updateTimesheetEntry,
  upsertTimesheetEntry,
} from "../services/timesheets.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerTimesheetRoutes(app: express.Express) {
  // Endpoint para obtener meses registrados
  app.get(
    "/api/timesheets/months",
    authenticate,
    authorize("read", "Timesheet"),
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

      // Combinar meses disponibles por defecto con meses que tienen datos
      const allMonths = new Set([...availableMonths, ...Array.from(monthsWithData)]);
      const sortedMonths = Array.from(allMonths).sort((a, b) => b.localeCompare(a)); // Descending order

      res.json({
        status: "ok",
        months: sortedMonths,
        monthsWithData: Array.from(monthsWithData),
      });
    })
  );

  app.get(
    "/api/timesheets",
    authenticate,
    authorize("read", "Timesheet"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = timesheetListQuerySchema.parse(req.query);

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
    authorize("create", "Timesheet"),
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
    authorize("update", "Timesheet"),
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
    authorize("update", "Timesheet"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      await deleteTimesheetEntry(id);
      logEvent("timesheets:delete", requestContext(req, { id }));
      res.json({ status: "ok" });
    })
  );

  app.post(
    "/api/timesheets/bulk",
    authorize("update", "Timesheet"),
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
          worked_minutes: entry.worked_minutes ?? 0,
          overtime_minutes: entry.overtime_minutes ?? 0,
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
    authorize("read", "Timesheet"),
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
    authorize("read", "Timesheet"),
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
    authorize("read", "Timesheet"),
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
      // Map using person.names
      const employeeNameMap = new Map(employees.map((emp) => [emp.id, emp.person.names]));
      const employeeRoleMap = new Map(employees.map((emp) => [emp.id, emp.position]));

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

  // Endpoint de status removido - ya no se usa SMTP

  // Generar archivo .eml para enviar boleta de honorarios
  app.post(
    "/api/timesheets/prepare-email",
    authenticate,
    authorize("update", "Timesheet"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = prepareEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("timesheets:prepare-email:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      const { employeeId, month, monthLabel, pdfBase64 } = parsed.data;

      // Convertir mes a español si viene en inglés
      let monthLabelEs = monthLabel;
      const monthNames: Record<string, string> = {
        january: "Enero",
        february: "Febrero",
        march: "Marzo",
        april: "Abril",
        may: "Mayo",
        june: "Junio",
        july: "Julio",
        august: "Agosto",
        september: "Septiembre",
        october: "Octubre",
        november: "Noviembre",
        december: "Diciembre",
      };
      const monthMatch = monthLabel.toLowerCase().match(/^(\w+)\s+(\d{4})$/);
      if (monthMatch && monthNames[monthMatch[1]]) {
        monthLabelEs = `${monthNames[monthMatch[1]]} ${monthMatch[2]}`;
      }

      // Obtener datos del empleado
      const employee = await getEmployeeById(employeeId);
      if (!employee) {
        return res.status(404).json({ status: "error", message: "Empleado no encontrado" });
      }

      const employeeEmail = employee.person.email;
      if (!employeeEmail) {
        return res.status(400).json({ status: "error", message: "El empleado no tiene email registrado" });
      }

      // Obtener resumen del mes
      const { from, to } = getMonthRange(month);
      const summary = await buildMonthlySummary(from, to, employeeId);
      const employeeSummary = summary.employees.find((e) => e.employeeId === employeeId);

      if (!employeeSummary) {
        return res.status(404).json({ status: "error", message: "No hay datos de timesheet para este periodo" });
      }

      // Convertir PDF de base64 a Buffer
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      const safeName = (employee.person.names || "Prestador").replace(/[^a-zA-Z0-9_\- ]/g, "");
      const pdfFilename = `Honorarios_${safeName}_${monthLabelEs.replace(/\s+/g, "_")}.pdf`;

      // Calcular monto de horas extras
      const overtimeAmount = roundCurrency((employeeSummary.overtimeMinutes / 60) * employeeSummary.overtimeRate);

      // Generar archivo .eml
      const result = generateTimesheetEml({
        employeeName: employee.person.names,
        employeeEmail,
        role: employee.position,
        month: monthLabelEs,
        hoursWorked: employeeSummary.hoursFormatted,
        overtime: employeeSummary.overtimeFormatted,
        hourlyRate: employeeSummary.hourlyRate,
        overtimeAmount,
        subtotal: employeeSummary.subtotal,
        retention: employeeSummary.retention,
        retentionRate: employeeSummary.retentionRate,
        netAmount: employeeSummary.net,
        payDate: employeeSummary.payDate,
        pdfBuffer,
        pdfFilename,
        fromEmail: "contacto@bioalergia.cl",
        fromName: "Bioalergia",
      });

      logEvent("timesheets:prepare-email:success", requestContext(req, { employeeId, month, to: employeeEmail }));

      // Devolver el archivo .eml como base64 para que el frontend lo descargue
      res.json({
        status: "ok",
        emlBase64: Buffer.from(result.emlContent).toString("base64"),
        filename: result.filename,
      });
    })
  );
}
