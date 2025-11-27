import dayjs from "dayjs";
import type { BulkRow, TimesheetEntry, TimesheetSummaryRow } from "./types";

export function buildBulkRows(month: string, entries: TimesheetEntry[]): BulkRow[] {
  const base = dayjs(`${month}-01`);
  const days = base.daysInMonth();
  const entryMap = new Map(entries.map((entry) => [entry.work_date, entry]));
  const rows: BulkRow[] = [];
  for (let day = 1; day <= days; day += 1) {
    const date = base.date(day).format("YYYY-MM-DD");
    const entry = entryMap.get(date);
    const extraMinutes = entry && entry.overtime_minutes ? entry.overtime_minutes : 0;
    rows.push({
      date,
      entrada: entry?.start_time ?? "",
      salida: entry?.end_time ?? "",
      overtime: extraMinutes ? minutesToDuration(extraMinutes) : "",
      comment: entry?.comment ?? "",
      entryId: entry?.id ?? null,
    });
  }
  return rows;
}

export function hasRowData(row: BulkRow): boolean {
  return Boolean(row.entrada.trim() || row.salida.trim() || row.overtime.trim() || row.comment.trim());
}

const editableFields: Array<keyof Pick<BulkRow, "entrada" | "salida" | "overtime" | "comment">> = [
  "entrada",
  "salida",
  "overtime",
  "comment",
];

export function isRowDirty(row: BulkRow, initial?: BulkRow): boolean {
  if (!initial) return hasRowData(row);
  return editableFields.some((field) => row[field] !== initial[field]);
}

export function computeStatus(row: BulkRow, dirty: boolean): string {
  if (row.entryId && !dirty) return "Registrado";
  if (row.entryId && dirty) return "Sin guardar";
  if (!row.entryId && hasRowData(row)) return "Sin guardar";
  return "No trabajado";
}

export function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^[0-9]{1,2}:[0-9]{2}$/.test(trimmed)) return null;
  const parts = trimmed.split(":").map(Number);
  const [hours, minutes] = parts;
  if (hours === undefined || minutes === undefined) return null;
  if (minutes >= 60) return null;
  return hours * 60 + minutes;
}

export function calculateWorkedMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === "00:00" || endTime === "00:00") return 0;

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start === null || end === null) return 0;

  let totalMinutes = end - start;

  // Si end < start, asumimos que cruza medianoche (ej: 22:00 a 06:00)
  if (totalMinutes < 0) {
    totalMinutes = 24 * 60 + totalMinutes;
  }

  return totalMinutes;
}

function timeToMinutes(time: string): number | null {
  if (!/^[0-9]{1,2}:[0-9]{2}$/.test(time)) return null;
  const parts = time.split(":").map(Number);
  const [hours, minutes] = parts;
  if (hours === undefined || minutes === undefined) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
}

export function formatDateLabel(value: string): string {
  return dayjs(value).format("DD-MM-YYYY");
}

export function computeExtraAmount(extraMinutes: number, hourlyRate: number): number {
  if (!hourlyRate || extraMinutes <= 0) return 0;
  return Math.round((extraMinutes / 60) * hourlyRate * 100) / 100;
}

export function formatExtraHours(row: TimesheetSummaryRow): string {
  // Si no hay extraAmount, retornar 00:00
  if (!row.extraAmount) return "00:00";

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
    if (!row.extraAmount) continue;

    // Si hay overtimeRate definido, calcular horas basado en extraAmount / overtimeRate
    if (row.overtimeRate > 0) {
      totalMinutes += Math.round((row.extraAmount / row.overtimeRate) * 60);
    } else {
      // Si overtimeRate es 0, usar las horas extra reales del timesheet
      totalMinutes += row.overtimeMinutes || 0;
    }
  }
  return minutesToDuration(totalMinutes);
}

export function minutesToDuration(totalMinutes: number): string {
  if (totalMinutes < 0) {
    return "-" + minutesToDuration(-totalMinutes);
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
