import { parseTime, type Time } from "@internationalized/date";
import dayjs from "dayjs";

import type { BulkRow, TimesheetEntry, TimesheetSummaryRow } from "./types";

export function buildBulkRows(month: string, entries: TimesheetEntry[]): BulkRow[] {
  const base = dayjs(`${month}-01`);
  const days = base.daysInMonth();
  const entryMap = new Map(
    entries.map((entry) => [entry.work_date, entry]),
  );
  const rows: BulkRow[] = [];
  for (let day = 1; day <= days; day += 1) {
    const dateKey = base.date(day).format("YYYY-MM-DD");
    const dateValue = new Date(`${dateKey}T00:00:00`);
    const entry = entryMap.get(dateKey);
    const extraMinutes = entry?.overtime_minutes || 0;
    rows.push({
      comment: entry?.comment ?? "",
      date: dateValue,
      entrada: normalizeTimeString(entry?.start_time),
      entryId: entry?.id ?? null,
      overtime: extraMinutes ? minutesToDuration(extraMinutes) : "",
      salida: normalizeTimeString(entry?.end_time),
    });
  }
  return rows;
}

export function hasRowData(row: BulkRow): boolean {
  return Boolean(
    row.entrada.trim() || row.salida.trim() || row.overtime.trim() || row.comment.trim(),
  );
}

const editableFields: (keyof Pick<BulkRow, "comment" | "entrada" | "overtime" | "salida">)[] = [
  "entrada",
  "salida",
  "overtime",
  "comment",
];

export function calculateWorkedMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === "00:00" || endTime === "00:00") {
    return 0;
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start === null || end === null) {
    return 0;
  }

  let totalMinutes = end - start;

  // Si end < start, asumimos que cruza medianoche (ej: 22:00 a 06:00)
  if (totalMinutes < 0) {
    totalMinutes = 24 * 60 + totalMinutes;
  }

  return totalMinutes;
}

export function computeExtraAmount(extraMinutes: number, hourlyRate: number): number {
  if (!hourlyRate || extraMinutes <= 0) {
    return 0;
  }
  return Math.round((extraMinutes / 60) * hourlyRate * 100) / 100;
}

export function computeStatus(row: BulkRow, dirty: boolean): string {
  if (row.entryId && !dirty) {
    return "Registrado";
  }
  if (row.entryId && dirty) {
    return "Sin guardar";
  }
  if (!row.entryId && hasRowData(row)) {
    return "Sin guardar";
  }
  return "No trabajado";
}

export function formatDateLabel(value: Date | string | null): string {
  if (!value) {
    return "—";
  }
  const date = dayjs(value);
  return date.isValid() ? date.format("DD-MM-YYYY") : String(value);
}

export function formatExtraHours(row: TimesheetSummaryRow): string {
  // Si no hay extraAmount, retornar 00:00
  if (!row.extraAmount) {
    return "00:00";
  }

  // Si hay overtimeRate definido, calcular horas basado en extraAmount / overtimeRate
  if (row.overtimeRate > 0) {
    const minutes = Math.round((row.extraAmount / row.overtimeRate) * 60);
    return minutesToDuration(minutes);
  }

  // Si overtimeRate es 0 pero hay extraAmount, mostrar las horas extra reales del timesheet
  // En este caso, las horas extra no se pagan pero sí se registran
  return minutesToDuration(row.overtimeMinutes || 0);
}

export function formatTotalExtraHours(rows: TimesheetSummaryRow[]): string {
  let totalMinutes = 0;
  for (const row of rows) {
    // Si no hay extraAmount, continuar
    if (!row.extraAmount) {
      continue;
    }

    // Si hay overtimeRate definido, calcular horas basado en extraAmount / overtimeRate
    totalMinutes +=
      row.overtimeRate > 0
        ? Math.round((row.extraAmount / row.overtimeRate) * 60)
        : row.overtimeMinutes || 0;
  }
  return minutesToDuration(totalMinutes);
}

export function isRowDirty(row: BulkRow, initial?: BulkRow): boolean {
  if (!initial) {
    return hasRowData(row);
  }
  return editableFields.some((field) => row[field] !== initial[field]);
}

export function minutesToDuration(totalMinutes: number): string {
  if (totalMinutes < 0) {
    return `-${minutesToDuration(-totalMinutes)}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const TIME_HH_MM_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

function parseTimeValue(value: string): null | Time {
  const cleaned = value.trim();
  if (!cleaned || !TIME_HH_MM_REGEX.test(cleaned)) {
    return null;
  }
  try {
    return parseTime(cleaned);
  } catch {
    return null;
  }
}

export function isValidTimeString(value: string): boolean {
  return parseTimeValue(value) !== null;
}

export function normalizeTimeString(value?: null | string): string {
  if (!value) {
    return "";
  }
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return value.trim();
  }
  const hours = String(parsed.hour).padStart(2, "0");
  const minutes = String(parsed.minute).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseDuration(value: string): null | number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  if (!TIME_HH_MM_REGEX.test(trimmed)) {
    return null;
  }
  const parts = trimmed.split(":").map(Number);
  const [hours, minutes, seconds] = parts;
  if (hours === undefined || minutes === undefined) {
    return null;
  }
  if (minutes >= 60) {
    return null;
  }
  if (seconds !== undefined && seconds >= 60) {
    return null;
  }
  return hours * 60 + minutes;
}

function timeToMinutes(time: string): null | number {
  const parsed = parseTimeValue(time);
  if (!parsed) {
    return null;
  }
  return parsed.hour * 60 + parsed.minute;
}
