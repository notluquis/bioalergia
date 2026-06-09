/**
 * Hook for managing timesheet audit state and data fetching
 */
import { formatChile } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchMultiEmployeeTimesheets } from "../api";
import { timesheetAuditKeys } from "../queries";
import type { TimesheetEntryWithEmployee } from "../types";

export interface AuditDateRange {
  end: Date;
  start: Date;
}

interface UseTimesheetAuditOptions {
  employeeIds: number[];
  ranges: AuditDateRange[];
}

export function useTimesheetAudit({ employeeIds, ranges }: UseTimesheetAuditOptions) {
  const sortedRanges = useMemo(
    () => ranges.toSorted((a, b) => a.start.getTime() - b.start.getTime()),
    [ranges]
  );
  const firstDay = sortedRanges[0]?.start;
  const lastDay = sortedRanges.at(-1)?.end;

  const shouldFetch =
    employeeIds.length > 0 && ranges.length > 0 && Boolean(firstDay) && Boolean(lastDay);

  const {
    data: entries = [],
    error,
    isLoading,
  } = useQuery({
    enabled: shouldFetch,
    queryFn: async () => {
      if (!firstDay || !lastDay) {
        return [];
      }
      const data = await fetchMultiEmployeeTimesheets(
        employeeIds,
        formatChile(firstDay, "YYYY-MM-DD"),
        formatChile(lastDay, "YYYY-MM-DD")
      );
      return filterAuditEntries(data, sortedRanges);
    },
    queryKey: timesheetAuditKeys.audit(employeeIds, firstDay, lastDay, sortedRanges),
  });

  return { entries: entries, error, isLoading };
}

function filterAuditEntries(data: TimesheetEntryWithEmployee[], ranges: AuditDateRange[]) {
  return data.filter((entry) => ranges.some((range) => isWithinRange(entry.work_date, range)));
}

function isWithinRange(date: string, range: AuditDateRange) {
  const startKey = formatChile(range.start, "YYYY-MM-DD");
  const endKey = formatChile(range.end, "YYYY-MM-DD");
  return date >= startKey && date <= endKey;
}
