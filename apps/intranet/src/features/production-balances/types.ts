import { z } from "zod";

export const DailyBalanceFormSchema = z.object({
  // Ingresos por servicio (desglose)
  consultas: z.number().min(0).default(0),
  controles: z.number().min(0).default(0),
  efectivo: z.number().min(0).default(0),

  // Gastos
  gastos: z.number().min(0).default(0),

  licencias: z.number().min(0).default(0),
  // Notas
  nota: z.string().default(""),
  otros: z.number().min(0).default(0),
  roxair: z.number().min(0).default(0),
  // Ingresos por método
  tarjeta: z.number().min(0).default(0),
  tests: z.number().min(0).default(0),
  transferencia: z.number().min(0).default(0),

  vacunas: z.number().min(0).default(0),
});

export type DailyBalanceFormData = z.infer<typeof DailyBalanceFormSchema>;

export interface BalanceSummary {
  cuadra: boolean;
  diferencia: number;
  gastos: number;
  totalMetodos: number;
  totalServicios: number;
}

/**
 * Estado visual de un día:
 * - `empty`: sin entrada (o sin montos)
 * - `draft`: entrada en borrador que cuadra
 * - `unbalanced`: entrada en borrador que NO cuadra
 * - `finalized`: día cerrado (status FINALIZED en API)
 */
export type DayStatus = "draft" | "empty" | "finalized" | "unbalanced";

export interface DayCell {
  date: Date;
  dayName: string; // "L", "M", "X", "J", "V", "S", "D"
  dayNumber: number;
  status: DayStatus;
  total: number;
}

export interface WeekData {
  days: DayCell[];
  weekLabel: string; // "5 – 11 ene 2026"
}

/** Resumen por día que alimenta el WeekStrip, derivado de la respuesta del API. */
export interface DayEntrySummary {
  cuadra: boolean;
  finalized: boolean;
  total: number;
}
