/**
 * Daily Balance V2 utilities
 * Reuses existing format utilities from @/lib/format
 */

// Re-export existing formatters
import { coerceAmount, fmtCLP, formatRelativeDate, numberFormatter } from "@/lib/format";

export { coerceAmount, fmtCLP, formatRelativeDate, numberFormatter };

/**
 * Calculate summary from form data
 */
export function calculateSummary(data: {
  consultas: number;
  controles: number;
  efectivo: number;
  gastos: number;
  licencias: number;
  otros: number;
  roxair: number;
  tarjeta: number;
  tests: number;
  transferencia: number;
  vacunas: number;
}) {
  const totalMetodos = data.tarjeta + data.transferencia + data.efectivo;
  const totalServicios =
    data.consultas +
    data.controles +
    data.tests +
    data.vacunas +
    data.licencias +
    data.roxair +
    data.otros;
  const diferencia = totalMetodos - totalServicios;
  const cuadra = diferencia === 0;

  return {
    cuadra,
    diferencia,
    gastos: data.gastos,
    totalMetodos,
    totalServicios,
  };
}

/**
 * Format date for large display
 * E.g. "2026-01-10" → "Sáb 10 Ene 2026"
 */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
}

/**
 * Format relative time for "Guardado hace X" (shorter version)
 */
export function formatSaveTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) {
    return "ahora";
  }
  if (diffSec < 60) {
    return `${diffSec}s`;
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m`;
  }
  return `${Math.floor(diffSec / 3600)}h`;
}

/**
 * Get day abbreviation for week strip
 */
export function getDayAbbrev(date: Date): string {
  const day = date.getDay();
  // getDay() always returns 0-6, so this is safe
  // biome-ignore lint/style/noNonNullAssertion: safe index
  return ["D", "L", "M", "X", "J", "V", "S"][day]!;
}
