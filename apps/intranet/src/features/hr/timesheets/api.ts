import { z } from "zod";
import type { timesheetEntrySchema } from "@finanzas/orpc-contracts/timesheets";
import { apiClient } from "@/lib/api-client";
import { zDateString } from "@/lib/api-validate";
import { timesheetsORPCClient, toTimesheetsApiError } from "./orpc";
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
  work_date: zDateString,
  worked_minutes: z.number(),
});

type TimesheetEntryTransport = z.infer<typeof timesheetEntrySchema>;
type TimesheetEntriesTransport = TimesheetEntryTransport[];

const TimesheetDetailResponseSchema = z.object({
  entries: z.array(TimesheetEntrySchema),
  from: zDateString,
  message: z.string().optional(),
  status: z.string(),
  to: zDateString,
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
        payDate: z.string(),
        retention: z.number(),
        retention_rate: z.number().nullable().optional(),
        retentionRate: z.number(),
        role: z.string(),
        subtotal: z.number(),
        workedMinutes: z.number(),
      })
    )
    .default([]),
  from: zDateString.optional(),
  message: z.string().optional(),
  month: z.string().optional(),
  status: z.string(),
  to: zDateString.optional(),
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

const PrepareEmailPayloadSchema = z.object({
  to: z.email(),
  from: z.email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  attachments: z.array(
    z.object({
      filename: z.string(),
      contentBase64: z.string(),
      contentType: z.string(),
    })
  ),
});

const PreviewEmailSchema = z.object({
  attachmentName: z.string(),
  attachmentType: z.string(),
  from: z.email(),
  html: z.string(),
  subject: z.string(),
  text: z.string(),
  to: z.email(),
});

const PrepareEmailPayloadResponseSchema = z.object({
  payload: PrepareEmailPayloadSchema,
  message: z.string().optional(),
  status: z.string(),
});

const PreviewEmailResponseSchema = z.object({
  preview: PreviewEmailSchema,
  message: z.string().optional(),
  status: z.string(),
});

const TimesheetEntryResponseSchema = z.object({
  entry: z.unknown(),
  message: z.string().optional(),
  status: z.string(),
});

function normalizeTimesheetEntry(entry: TimesheetEntryTransport): TimesheetEntry {
  const workDate = entry.work_date;
  return {
    ...entry,
    work_date:
      workDate instanceof Date ? workDate.toISOString().slice(0, 10) : (workDate as string),
  } as TimesheetEntry;
}

function normalizeTimesheetEntries(entries: TimesheetEntriesTransport) {
  return entries.map((entry) => normalizeTimesheetEntry(entry));
}

function serializeTimesheetPayload(payload: TimesheetPayload) {
  return {
    comment: payload.comment ?? undefined,
    employee_id: payload.employee_id,
    end_time: payload.end_time ?? undefined,
    overtime_minutes: payload.overtime_minutes ?? undefined,
    start_time: payload.start_time ?? undefined,
    work_date: payload.work_date,
    worked_minutes: payload.worked_minutes,
  };
}

export async function bulkUpsertTimesheets(
  employeeId: number,
  entries: TimesheetUpsertEntry[] = [],
  removeIds: number[] = []
) {
  let data: { inserted: number; message?: string; removed: number; status: string };
  try {
    data = BulkUpsertResponseSchema.parse(
      await timesheetsORPCClient.bulkUpsert({
        employee_id: employeeId,
        entries,
        remove_ids: removeIds.length > 0 ? removeIds : undefined,
      })
    );
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al procesar registros");
  }
  return data;
}

export async function deleteTimesheet(id: number) {
  let data: { message?: string; status: string };
  try {
    data = StatusResponseSchema.parse(await timesheetsORPCClient.remove({ id }));
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al eliminar registro");
  }
}

export async function fetchImageBlob(url: string) {
  return apiClient.getRaw<Blob>(url, { responseType: "blob" });
}

export async function fetchTimesheetDetail(employeeId: number, month: string) {
  let data: {
    entries: TimesheetEntry[];
    from: string;
    message?: string;
    status: string;
    to: string;
  };
  try {
    const response = await timesheetsORPCClient.employeeDetail({ employeeId, month });
    data = TimesheetDetailResponseSchema.parse({
      ...response,
      entries: normalizeTimesheetEntries(response.entries),
    });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar detalle");
  }
  return data;
}

export async function fetchTimesheetMonths() {
  let data: { months: string[]; monthsWithData: string[]; status: string };
  try {
    data = TimesheetMonthsResponseSchema.parse(await timesheetsORPCClient.months());
  } catch (error) {
    throw toTimesheetsApiError(error);
  }
  if (data.status !== "ok") {
    throw new Error("No se pudieron cargar los meses");
  }
  return {
    months: data.months,
    monthsWithData: new Set(data.monthsWithData || []),
  };
}

export async function fetchTimesheetSummary(month: string, employeeId?: null | number) {
  let data: TimesheetSummaryResponse & { message?: string; status: string };
  try {
    data = TimesheetSummaryResponseSchema.parse(
      await timesheetsORPCClient.summary({
        employeeId: employeeId ?? undefined,
        month,
      })
    ) as TimesheetSummaryResponse & { message?: string; status: string };
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar resumen");
  }
  return data;
}

export async function prepareTimesheetEmailPayload(payload: {
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
  let data: {
    payload: z.infer<typeof PrepareEmailPayloadSchema>;
    message?: string;
    status: string;
  };
  try {
    data = PrepareEmailPayloadResponseSchema.parse(
      await timesheetsORPCClient.prepareEmailPayload({
        ...payload,
        summary: payload.summary,
      })
    );
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al preparar el email");
  }

  return data;
}

export async function fetchTimesheetEmailPreview(payload: {
  employeeEmail: string;
  employeeId: number;
  employeeName: string;
  month: string;
  monthLabel: string;
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
  let data: {
    preview: z.infer<typeof PreviewEmailSchema>;
    message?: string;
    status: string;
  };
  try {
    data = PreviewEmailResponseSchema.parse(await timesheetsORPCClient.previewEmail(payload));
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al preparar la vista previa");
  }

  return data.preview;
}

export async function updateTimesheet(id: number, payload: Partial<TimesheetPayload>) {
  let data: { entry: TimesheetEntry; message?: string; status: string };
  try {
    const response = await timesheetsORPCClient.update({ id, payload });
    const parsed = TimesheetEntryResponseSchema.parse({
      ...response,
      entry: normalizeTimesheetEntry(response.entry as TimesheetEntryTransport),
    });
    data = {
      ...parsed,
      entry: normalizeTimesheetEntry(parsed.entry as TimesheetEntryTransport),
    };
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al actualizar registro");
  }
  return data.entry;
}

export async function upsertTimesheet(payload: TimesheetPayload) {
  let data: { entry: TimesheetEntry; message?: string; status: string };
  try {
    const response = await timesheetsORPCClient.create(serializeTimesheetPayload(payload));
    const parsed = TimesheetEntryResponseSchema.parse({
      ...response,
      entry: normalizeTimesheetEntry(response.entry as TimesheetEntryTransport),
    });
    data = {
      ...parsed,
      entry: normalizeTimesheetEntry(parsed.entry as TimesheetEntryTransport),
    };
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al guardar registro");
  }
  return data.entry;
}
