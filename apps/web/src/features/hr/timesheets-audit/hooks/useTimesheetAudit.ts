/**
 * Hook for managing timesheet audit state and data fetching
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
  const sortedRanges = useMemo(() => ranges.toSorted((a, b) => a.start.localeCompare(b.start)), [ranges]);
  const firstDay = sortedRanges[0]?.start;
  const lastDay = sortedRanges.at(-1)?.end;

  const shouldFetch = employeeIds.length > 0 && ranges.length > 0 && !!firstDay && !!lastDay;

  const {
    data: entries = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["timesheet-audit", employeeIds, firstDay, lastDay, sortedRanges],
    queryFn: async () => {
      const data = await fetchMultiEmployeeTimesheets(employeeIds, firstDay!, lastDay!);
      return filterAuditEntries(data, sortedRanges);
    },
    enabled: shouldFetch,
  });

  return { entries: entries as TimesheetEntryWithEmployee[], isLoading, error };
}
