/**
 * Hook for managing timesheet audit state and data fetching
 */

import { useEffect, useState } from "react";

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

function filterAuditEntries(data: TimesheetEntryWithEmployee[], ranges: AuditDateRange[]) {
  return data.filter((entry) => ranges.some((range) => isWithinRange(entry.work_date, range)));
}

export function useTimesheetAudit({ ranges, employeeIds }: UseTimesheetAuditOptions) {
  const [entries, setEntries] = useState<TimesheetEntryWithEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // Prevent state updates after unmount

    async function loadEntries() {
      if (employeeIds.length === 0 || ranges.length === 0) {
        if (isMounted) setEntries([]);
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        const sortedRanges = ranges.toSorted((a, b) => a.start.localeCompare(b.start));
        const firstDay = sortedRanges[0]?.start;
        const lastDay = sortedRanges.at(-1)?.end;

        if (!firstDay || !lastDay) {
          if (isMounted) setEntries([]);
          return;
        }

        const data = await fetchMultiEmployeeTimesheets(employeeIds, firstDay, lastDay);

        const filtered = filterAuditEntries(data, sortedRanges);
        if (isMounted) setEntries(filtered);
      } catch (error_) {
        if (!isMounted) return; // Don't update state if unmounted

        const message = error_ instanceof Error ? error_.message : "Error cargando datos de auditoría";
        setError(message);
        setEntries([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEntries();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [ranges, employeeIds]);

  return { entries, loading, error };
}
