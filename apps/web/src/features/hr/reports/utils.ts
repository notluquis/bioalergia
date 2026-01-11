import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

import type { TimesheetEntry } from "../timesheets/types";
import type { EmployeeWorkData, ReportGranularity } from "./types";

dayjs.extend(isoWeek);

/**
 * Convierte minutos a formato HH:MM
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

/**
 * Agrupa entradas por día
 */
export function groupByDay(entries: TimesheetEntry[]): Record<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const date = entry.work_date;
    const current = map.get(date) ?? 0;
    map.set(date, current + entry.worked_minutes);
  });
  return Object.fromEntries(map);
}

/**
 * Agrupa entradas por semana (ISO Week)
 */
export function groupByWeek(entries: TimesheetEntry[]): Record<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const date = dayjs(entry.work_date);
    const week = date.isoWeek();
    const year = date.isoWeekYear();
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const current = map.get(key) ?? 0;
    map.set(key, current + entry.worked_minutes);
  });
  return Object.fromEntries(map);
}

/**
 * Agrupa entradas por mes
 */
export function groupByMonth(entries: TimesheetEntry[]): Record<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const month = dayjs(entry.work_date).format("YYYY-MM");
    const current = map.get(month) ?? 0;
    map.set(month, current + entry.worked_minutes);
  });
  return Object.fromEntries(map);
}

/**
 * Convierte entradas a estructura de datos para reportes
 */
export function processEmployeeData(
  employeeId: number,
  fullName: string,
  role: string,
  entries: TimesheetEntry[]
): EmployeeWorkData {
  const totalMinutes = entries.reduce((sum, e) => sum + e.worked_minutes, 0);
  const totalOvertimeMinutes = entries.reduce((sum, e) => sum + e.overtime_minutes, 0);

  // Calculate distinct days worked (entries might be multiple per day, though typically 1 per day/emp in this system, but let's be safe)
  const uniqueDays = new Set(entries.map((e) => e.work_date));
  const totalDays = uniqueDays.size;

  const avgDailyMinutes = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0;
  const overtimePercentage =
    totalMinutes > 0 ? Number.parseFloat(((totalOvertimeMinutes / totalMinutes) * 100).toFixed(1)) : 0;

  return {
    employeeId,
    fullName,
    role,
    totalMinutes,
    totalOvertimeMinutes,
    totalDays,
    avgDailyMinutes,
    overtimePercentage,
    dailyBreakdown: groupByDay(entries),
    weeklyBreakdown: groupByWeek(entries),
    monthlyBreakdown: groupByMonth(entries),
  };
}

/**
 * Prepara datos para gráfico (formato Recharts)
 */
export function prepareChartData(data: EmployeeWorkData, granularity: ReportGranularity) {
  const breakdownMap = {
    day: data.dailyBreakdown,
    week: data.weeklyBreakdown,
    month: data.monthlyBreakdown,
  };
  const breakdown = breakdownMap[granularity];

  return Object.entries(breakdown).map(([period, minutes]) => ({
    period,

    [data.fullName]: Number.parseFloat((minutes / 60).toFixed(2)), // Convertir a horas
    minutes,
  }));
}

/**
 * Prepara datos comparativos
 */
export function prepareComparisonData(employees: EmployeeWorkData[], granularity: ReportGranularity) {
  if (employees.length === 0) return [];

  const breakdownKeyMap = {
    day: "dailyBreakdown",
    week: "weeklyBreakdown",
    month: "monthlyBreakdown",
  } as const;
  const breakdown = breakdownKeyMap[granularity];

  // Obtener todas las fechas/semanas/meses
  const allPeriods = new Set<string>();
  employees.forEach((emp) => {
    Object.keys(emp[breakdown]).forEach((period) => allPeriods.add(period));
  });

  const periods = [...allPeriods].toSorted((a, b) => a.localeCompare(b));

  return periods.map((period) => {
    const dataPoint: Record<string, string | number> = { period };
    employees.forEach((emp) => {
      const minutes = emp[breakdown][period] || 0;

      dataPoint[emp.fullName] = Number.parseFloat((minutes / 60).toFixed(2));
    });
    return dataPoint;
  });
}

/**
 * Calcula estadísticas
 */
/**
 * Calcula estadísticas
 * @param data Datos de los empleados
 * @param periodCount Cantidad de periodos (días, semanas, meses) en el rango
 */
export function calculateStats(data: EmployeeWorkData[], periodCount = 1) {
  if (data.length === 0) return null;

  const totalHours = data.reduce((sum, emp) => sum + emp.totalMinutes, 0) / 60;

  // Promedio = Total Horas / (Cantidad de Empleados * Cantidad de Periodos)
  // Ej: 1600 horas / (10 empleados * 1 mes) = 160h promedio/emp/mes
  const averageHours = totalHours / (data.length * Math.max(periodCount, 1));

  const maxEmployee = data.reduce((max, emp) => (emp.totalMinutes > max.totalMinutes ? emp : max), data[0]!);
  const minEmployee = data.reduce((min, emp) => (emp.totalMinutes < min.totalMinutes ? emp : min), data[0]!);

  return {
    totalHours: Number.parseFloat(totalHours.toFixed(2)),
    averageHours: Number.parseFloat(averageHours.toFixed(2)),
    maxEmployee: { name: maxEmployee.fullName, hours: Number.parseFloat((maxEmployee.totalMinutes / 60).toFixed(2)) },
    minEmployee: { name: minEmployee.fullName, hours: Number.parseFloat((minEmployee.totalMinutes / 60).toFixed(2)) },
  };
}
