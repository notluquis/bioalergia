import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { formatISO } from "@/lib/dates";

import type {
  TimesheetEntry,
  TimesheetPayload,
  TimesheetSummaryResponse,
  TimesheetUpsertEntry,
} from "./types";

const BulkUpsertResponseSchema = z.object({
  inserted: z.number(),
  message: z.string().optional(),
  removed: z.number(),
  status: z.string(),
});

const StatusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.string(),
});

const TimesheetEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  employee_id: z.number(),
  end_time: z.string().nullable(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  work_date: z.string(),
  worked_minutes: z.number(),
});

const TimesheetDetailResponseSchema = z.object({
  entries: z.array(TimesheetEntrySchema),
  from: z.coerce.date(),
  message: z.string().optional(),
  status: z.string(),
  to: z.coerce.date(),
});

const TimesheetMonthsResponseSchema = z.object({
  months: z.array(z.string()),
  monthsWithData: z.array(z.string()),
  status: z.string(),
});

const TimesheetSummaryResponseSchema = z.looseObject({
  employees: z
    .array(
      z.object({
        email: z.string().nullable(),
        employeeId: z.number(),
        extraAmount: z.number(),
        fullName: z.string(),
        hourlyRate: z.number(),
        hoursFormatted: z.string(),
        net: z.number(),
        overtimeFormatted: z.string(),
        overtimeMinutes: z.number(),
        overtimeRate: z.number(),
        payDate: z.coerce.date(),
        retention: z.number(),
        retention_rate: z.number().nullable().optional(),
        retentionRate: z.number(),
        role: z.string(),
        subtotal: z.number(),
        workedMinutes: z.number(),
      }),
    )
    .default([]),
  from: z.coerce.date().optional(),
  message: z.string().optional(),
  month: z.string().optional(),
  status: z.string(),
  to: z.coerce.date().optional(),
  totals: z
    .object({
      extraAmount: z.number(),
      hours: z.string(),
      net: z.number(),
      overtime: z.string(),
      retention: z.number(),
      subtotal: z.number(),
    })
    .optional(),
});

const PrepareEmailResponseSchema = z.object({
  emlBase64: z.string(),
  filename: z.string(),
  message: z.string().optional(),
  status: z.string(),
});

const TimesheetEntryResponseSchema = z.object({
  entry: z.unknown(),
  message: z.string().optional(),
  status: z.string(),
});

export async function bulkUpsertTimesheets(
  employeeId: number,
  entries: TimesheetUpsertEntry[] = [],
  removeIds: number[] = [],
) {
  const serializedEntries = entries.map((entry) => ({
    ...entry,
    work_date: formatISO(entry.work_date),
  }));
  const data = await apiClient.post<{
    inserted: number;
    message?: string;
    removed: number;
    status: string;
  }>(
    "/api/timesheets/bulk",
    {
      employee_id: employeeId,
      entries: serializedEntries,
      remove_ids: removeIds.length > 0 ? removeIds : undefined,
    },
    { responseSchema: BulkUpsertResponseSchema },
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al procesar registros");
  }
  return data;
}

export async function deleteTimesheet(id: number) {
  const data = await apiClient.delete<{ message?: string; status: string }>(
    `/api/timesheets/${id}`,
    { responseSchema: StatusResponseSchema },
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al eliminar registro");
  }
}

export async function fetchImageBlob(url: string) {
  return apiClient.getRaw<Blob>(url, { responseType: "blob" });
}

export async function fetchTimesheetDetail(employeeId: number, month: string) {
  const data = await apiClient.get<{
    entries: TimesheetEntry[];
    from: string;
    message?: string;
    status: string;
    to: string;
  }>(`/api/timesheets/${employeeId}/detail`, {
    query: { month },
    responseSchema: TimesheetDetailResponseSchema,
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar detalle");
  }
  return data;
}

export async function fetchTimesheetMonths() {
  const data = await apiClient.get<{ months: string[]; monthsWithData: string[]; status: string }>(
    "/api/timesheets/months",
    { responseSchema: TimesheetMonthsResponseSchema },
  );
  if (data.status !== "ok") {
    throw new Error("No se pudieron cargar los meses");
  }
  return {
    months: data.months,
    monthsWithData: new Set(data.monthsWithData || []),
  };
}

export async function fetchTimesheetSummary(month: string, employeeId?: null | number) {
  const query: Record<string, string> = { month };
  if (employeeId) {
    query.employeeId = String(employeeId);
  }

  const data = await apiClient.get<TimesheetSummaryResponse & { message?: string; status: string }>(
    "/api/timesheets/summary",
    { query, responseSchema: TimesheetSummaryResponseSchema },
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar resumen");
  }
  return data;
}

export async function prepareTimesheetEmail(payload: {
  employeeEmail: string;
  employeeId: number;
  employeeName: string;
  month: string;
  monthLabel: string;
  pdfBase64: string;
  summary: {
    net: number;
    overtimeMinutes: number;
    payDate: string;
    retention: number;
    retention_rate?: null | number;
    retentionRate?: null | number;
    role: string;
    subtotal: number;
    workedMinutes: number;
  };
}) {
  const data = await apiClient.post<{
    emlBase64: string;
    filename: string;
    message?: string;
    status: string;
  }>("/api/timesheets/prepare-email", payload, { responseSchema: PrepareEmailResponseSchema });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al preparar el email");
  }

  return data;
}

export async function updateTimesheet(id: number, payload: Partial<TimesheetPayload>) {
  const requestPayload = payload.work_date
    ? { ...payload, work_date: formatISO(payload.work_date) }
    : payload;
  const data = await apiClient.put<{ entry: TimesheetEntry; message?: string; status: string }>(
    `/api/timesheets/${id}`,
    requestPayload,
    { responseSchema: TimesheetEntryResponseSchema },
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al actualizar registro");
  }
  return data.entry;
}

export async function upsertTimesheet(payload: TimesheetPayload) {
  const requestPayload = { ...payload, work_date: formatISO(payload.work_date) };
  const data = await apiClient.post<{ entry: TimesheetEntry; message?: string; status: string }>(
    "/api/timesheets",
    requestPayload,
    { responseSchema: TimesheetEntryResponseSchema },
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al guardar registro");
  }
  return data.entry;
}
