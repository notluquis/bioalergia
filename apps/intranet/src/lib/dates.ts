import dayjs, { type Dayjs } from "dayjs";

/**
 * Utilidades de fecha para evitar duplicación de patrones comunes con dayjs.
 * Centralizadas para consistencia y facilitar refactoring.
 */

/** Formato ISO estándar: "YYYY-MM-DD" */
export const ISO_DATE_FORMAT = "YYYY-MM-DD";

/**
 * Resta días a la fecha actual
 * @param days - Cantidad de días a restar
 * @returns Fecha N días atrás en formato ISO
 */
export function daysAgo(days: number): string {
  return dayjs().subtract(days, "day").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el último día del mes actual en formato ISO
 * @returns Último día del mes actual
 */
export function endOfMonth(): string {
  return dayjs().endOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el último día del mes de una fecha específica
 * @param date - Fecha base
 * @returns Último día del mes
 */
export function endOfMonthFor(date: Dayjs | string): string {
  return dayjs(date).endOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el último día del año actual
 * @returns Último día del año actual (YYYY-12-31)
 */
export function endOfYear(): string {
  return dayjs().endOf("year").format(ISO_DATE_FORMAT);
}

/**
 * Formatea una fecha arbitraria al formato ISO
 * @param date - Fecha a formatear (string, Date, Dayjs)
 * @returns Fecha en formato ISO
 */
export function formatISO(date: Date | Dayjs | string): string {
  return dayjs(date).format(ISO_DATE_FORMAT);
}

/**
 * Resta meses a la fecha actual y obtiene el último día de ese mes
 * @param months - Cantidad de meses a restar
 * @returns Último día del mes N meses atrás
 */
export function monthsAgoEnd(months: number): string {
  return dayjs().subtract(months, "month").endOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Resta meses a la fecha actual y obtiene el primer día de ese mes
 * @param months - Cantidad de meses a restar
 * @returns Primer día del mes N meses atrás
 */
export function monthsAgoStart(months: number): string {
  return dayjs().subtract(months, "month").startOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el primer día del mes actual en formato ISO
 * @returns Primer día del mes actual
 */
export function startOfMonth(): string {
  return dayjs().startOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el primer día del mes de una fecha específica
 * @param date - Fecha base
 * @returns Primer día del mes
 */
export function startOfMonthFor(date: Dayjs | string): string {
  return dayjs(date).startOf("month").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene el primer día del año actual
 * @returns Primer día del año actual (YYYY-01-01)
 */
export function startOfYear(): string {
  return dayjs().startOf("year").format(ISO_DATE_FORMAT);
}

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD)
 * @returns Fecha actual formateada
 */
export function today(): string {
  return dayjs().format(ISO_DATE_FORMAT);
}
