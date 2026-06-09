import type { Employee } from "@/features/hr/employees/types";

/**
 * Query keys for the HR salary/timesheet reports surface.
 *
 * The report query is manually triggered (a `timestamp` bumped on
 * "Generar reporte" forces the refetch) and has no external invalidation,
 * so a single `data` key mirroring the existing inline tuple is enough.
 */
export const reportKeys = {
  all: ["reports-data"] as const,
  data: (
    dateParams: { end: string; start: string } | null,
    employeeIds: number[],
    timestamp: number,
    employees: Employee[]
  ) => ["reports-data", dateParams, employeeIds, timestamp, employees] as const,
};
