/**
 * Hook for managing timesheet audit state and data fetching
 */

import { useCallback, useEffect, useState } from "react";
import { fetchMultiEmployeeTimesheets } from "../api";
import type { TimesheetEntryWithEmployee } from "../types";

export type AuditDateRange = { start: string; end: string };

interface UseTimesheetAuditOptions {
  ranges: AuditDateRange[];
  employeeIds: number[];
}

function isWithinRange(date: string, range: AuditDateRange) {
  return date >= range.start && date <= range.end;
}

export function useTimesheetAudit({ ranges, employeeIds }: UseTimesheetAuditOptions) {
  const [entries, setEntries] = useState<TimesheetEntryWithEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!employeeIds.length || !ranges.length) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sortedRanges = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
      const firstDay = sortedRanges[0]?.start;
      const lastDay = sortedRanges[sortedRanges.length - 1]?.end;

      if (!firstDay || !lastDay) {
        setEntries([]);
        return;
      }

      const data = await fetchMultiEmployeeTimesheets(employeeIds, firstDay, lastDay);
      const filtered = data.filter((entry) => sortedRanges.some((range) => isWithinRange(entry.work_date, range)));
      setEntries(filtered);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error cargando datos de auditoría";
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [ranges, employeeIds]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return { entries, loading, error };
}
