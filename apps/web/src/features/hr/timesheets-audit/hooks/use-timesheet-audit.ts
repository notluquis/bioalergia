/**
 * Hook for managing timesheet audit state and data fetching
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { TimesheetEntryWithEmployee } from "../types";

import { fetchMultiEmployeeTimesheets } from "../api";

export interface AuditDateRange {
  end: string;
  start: string;
}

interface UseTimesheetAuditOptions {
  employeeIds: number[];
  ranges: AuditDateRange[];
}

export function useTimesheetAudit({ employeeIds, ranges }: UseTimesheetAuditOptions) {
  const sortedRanges = useMemo(() => ranges.toSorted((a, b) => a.start.localeCompare(b.start)), [ranges]);
  const firstDay = sortedRanges[0]?.start;
  const lastDay = sortedRanges.at(-1)?.end;

  const shouldFetch = employeeIds.length > 0 && ranges.length > 0 && !!firstDay && !!lastDay;

  const {
    data: entries = [],
    error,
    isLoading,
  } = useQuery({
    enabled: shouldFetch,
    queryFn: async () => {
      const data = await fetchMultiEmployeeTimesheets(employeeIds, firstDay!, lastDay!);
      return filterAuditEntries(data, sortedRanges);
    },
    queryKey: ["timesheet-audit", employeeIds, firstDay, lastDay, sortedRanges],
  });

  return { entries: entries, error, isLoading };
}

function filterAuditEntries(data: TimesheetEntryWithEmployee[], ranges: AuditDateRange[]) {
  return data.filter((entry) => ranges.some((range) => isWithinRange(entry.work_date, range)));
}

function isWithinRange(date: string, range: AuditDateRange) {
  return date >= range.start && date <= range.end;
}
