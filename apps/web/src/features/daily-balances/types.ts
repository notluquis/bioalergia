import { z } from "zod";

// ==================== ZOD SCHEMAS ====================

export const DailyBalanceFormSchema = z.object({
  // Ingresos por método
  tarjeta: z.number().min(0).default(0),
  transferencia: z.number().min(0).default(0),
  efectivo: z.number().min(0).default(0),

  // Gastos
  gastos: z.number().min(0).default(0),

  // Ingresos por servicio (optional breakdown)
  consultas: z.number().min(0).default(0),
  controles: z.number().min(0).default(0),
  tests: z.number().min(0).default(0),
  vacunas: z.number().min(0).default(0),
  licencias: z.number().min(0).default(0),
  roxair: z.number().min(0).default(0),
  otros: z.number().min(0).default(0),

  // Notas
  nota: z.string().default(""),
});

export type DailyBalanceFormData = z.infer<typeof DailyBalanceFormSchema>;

// ==================== TYPES ====================

export type DayStatus = "empty" | "draft" | "balanced" | "unbalanced";

export interface DayCell {
  date: string;
  dayName: string; // "L", "M", "X", "J", "V", "S", "D"
  dayNumber: number;
  total: number;
  status: DayStatus;
  isSelected: boolean;
  isToday: boolean;
}

export interface WeekData {
  weekLabel: string; // "5 – 11 ene 2026"
  days: DayCell[];
}

export interface BalanceSummary {
  totalMetodos: number;
  totalServicios: number;
  gastos: number;
  diferencia: number;
  cuadra: boolean;
}

export interface DailyBalanceEntry {
  id?: number;
  date: string;
  tarjeta: number;
  transferencia: number;
  efectivo: number;
  gastos: number;
  consultas: number;
  controles: number;
  tests: number;
  vacunas: number;
  licencias: number;
  roxair: number;
  otros: number;
  nota: string;
  status: DayStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== API TYPES ====================

export interface FetchDayResponse {
  status: "ok";
  entry: DailyBalanceEntry | null;
}

export interface SaveDayResponse {
  status: "ok";
  entry: DailyBalanceEntry;
}

export interface FetchWeekResponse {
  status: "ok";
  week: WeekData;
  entries: Record<string, DailyBalanceEntry>;
}
