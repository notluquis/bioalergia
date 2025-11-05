import type { TimesheetEntry, TimesheetPayload, TimesheetSummaryResponse } from "./types";

async function handleResponse<T>(res: Response) {
  const data = await res.json();
  if (!res.ok || data.status !== "ok") {
    throw new Error(data.message || "Error inesperado en la solicitud");
  }
  return data as { status: "ok" } & T;
}

export async function fetchTimesheetSummary(month: string, employeeId?: number | null) {
  const params = new URLSearchParams({ month });
  if (employeeId) {
    params.set("employeeId", String(employeeId));
  }
  const res = await fetch(`/api/timesheets/summary?${params.toString()}`, {
    credentials: "include",
  });
  const data = await handleResponse<TimesheetSummaryResponse>(res);
  return data;
}

export async function fetchTimesheetDetail(employeeId: number, month: string) {
  const params = new URLSearchParams({ month });
  const res = await fetch(`/api/timesheets/${employeeId}/detail?${params.toString()}`, {
    credentials: "include",
  });
  const data = await handleResponse<{ entries: TimesheetEntry[]; from: string; to: string }>(res);
  return data;
}

export async function upsertTimesheet(payload: TimesheetPayload) {
  const res = await fetch(`/api/timesheets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ entry: TimesheetEntry }>(res);
  return data.entry;
}

export async function updateTimesheet(id: number, payload: Partial<TimesheetPayload>) {
  const res = await fetch(`/api/timesheets/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ entry: TimesheetEntry }>(res);
  return data.entry;
}

export async function deleteTimesheet(id: number) {
  const res = await fetch(`/api/timesheets/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handleResponse<{}>(res);
}

export async function bulkUpsertTimesheets(
  employeeId: number,
  entries: Array<{
    work_date: string;
    start_time: string | null;
    end_time: string | null;
    overtime_minutes: number;
    extra_amount: number;
    comment: string | null;
  }> = [],
  removeIds: number[] = []
) {
  const res = await fetch(`/api/timesheets/bulk`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      employee_id: employeeId,
      entries,
      remove_ids: removeIds.length ? removeIds : undefined,
    }),
  });
  return handleResponse<{ inserted: number; removed: number }>(res);
}
