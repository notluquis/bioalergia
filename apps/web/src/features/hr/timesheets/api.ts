import { apiClient } from "@/lib/apiClient";

import type { TimesheetEntry, TimesheetPayload, TimesheetSummaryResponse, TimesheetUpsertEntry } from "./types";

export async function fetchTimesheetSummary(month: string, employeeId?: number | null) {
  const query: Record<string, string> = { month };
  if (employeeId) query.employeeId = String(employeeId);

  const data = await apiClient.get<TimesheetSummaryResponse & { status: string; message?: string }>(
    "/api/timesheets/summary",
    { query }
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar resumen");
  }
  return data;
}

export async function fetchTimesheetDetail(employeeId: number, month: string) {
  const data = await apiClient.get<{
    entries: TimesheetEntry[];
    from: string;
    to: string;
    status: string;
    message?: string;
  }>(`/api/timesheets/${employeeId}/detail`, { query: { month } });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al cargar detalle");
  }
  return data;
}

export async function upsertTimesheet(payload: TimesheetPayload) {
  const data = await apiClient.post<{ entry: TimesheetEntry; status: string; message?: string }>(
    "/api/timesheets",
    payload
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al guardar registro");
  }
  return data.entry;
}

export async function updateTimesheet(id: number, payload: Partial<TimesheetPayload>) {
  const data = await apiClient.put<{ entry: TimesheetEntry; status: string; message?: string }>(
    `/api/timesheets/${id}`,
    payload
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al actualizar registro");
  }
  return data.entry;
}

export async function deleteTimesheet(id: number) {
  const data = await apiClient.delete<{ status: string; message?: string }>(`/api/timesheets/${id}`);

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al eliminar registro");
  }
}

export async function bulkUpsertTimesheets(
  employeeId: number,
  entries: TimesheetUpsertEntry[] = [],
  removeIds: number[] = []
) {
  const data = await apiClient.post<{ inserted: number; removed: number; status: string; message?: string }>(
    "/api/timesheets/bulk",
    {
      employee_id: employeeId,
      entries,
      remove_ids: removeIds.length ? removeIds : undefined,
    }
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al procesar registros");
  }
  return data;
}

export async function prepareTimesheetEmail(payload: {
  employeeId: number;
  month: string;
  monthLabel: string;
  pdfBase64: string;
}) {
  const data = await apiClient.post<{ status: string; message?: string; emlBase64: string; filename: string }>(
    "/api/timesheets/prepare-email",
    payload
  );

  if (data.status !== "ok") {
    throw new Error(data.message || "Error al preparar el email");
  }

  return data;
}

export async function fetchTimesheetMonths() {
  const data = await apiClient.get<{ status: string; months: string[]; monthsWithData: string[] }>(
    "/api/timesheets/months"
  );
  if (data.status !== "ok") {
    throw new Error("No se pudieron cargar los meses");
  }
  return {
    months: data.months,
    monthsWithData: new Set(data.monthsWithData || []),
  };
}

export async function fetchImageBlob(url: string) {
  return apiClient.get<Blob>(url, { responseType: "blob" });
}
