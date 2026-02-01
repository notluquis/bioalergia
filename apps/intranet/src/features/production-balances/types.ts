import { z } from "zod";

// ==================== ZOD SCHEMAS ====================

export const DailyBalanceFormSchema = z.object({
  // Ingresos por servicio (optional breakdown)
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

export interface BalanceSummary {
  cuadra: boolean;
  diferencia: number;
  gastos: number;
  totalMetodos: number;
  totalServicios: number;
}

// ==================== TYPES ====================

export interface DailyBalanceEntry {
  consultas: number;
  controles: number;
  createdAt?: Date;
  date: Date;
  efectivo: number;
  gastos: number;
  id?: number;
  licencias: number;
  nota: string;
  otros: number;
  roxair: number;
  status: DayStatus;
  tarjeta: number;
  tests: number;
  transferencia: number;
  updatedAt?: Date;
  vacunas: number;
}

export type DailyBalanceFormData = z.infer<typeof DailyBalanceFormSchema>;

export interface DayCell {
  date: Date;
  dayName: string; // "L", "M", "X", "J", "V", "S", "D"
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
  status: DayStatus;
  total: number;
}

export type DayStatus = "balanced" | "draft" | "empty" | "unbalanced";

export interface FetchDayResponse {
  entry: DailyBalanceEntry | null;
  status: "ok";
}

// ==================== API TYPES ====================

export interface FetchWeekResponse {
  entries: Record<string, DailyBalanceEntry>;
  status: "ok";
  week: WeekData;
}

export interface SaveDayResponse {
  entry: DailyBalanceEntry;
  status: "ok";
}

export interface WeekData {
  days: DayCell[];
  weekLabel: string; // "5 – 11 ene 2026"
}
