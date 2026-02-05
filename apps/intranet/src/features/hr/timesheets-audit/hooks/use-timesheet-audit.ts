/**
 * Hook for managing timesheet audit state and data fetching
 */
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo } from "react";
import { fetchMultiEmployeeTimesheets } from "../api";
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
    [ranges],
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
        dayjs(firstDay).format("YYYY-MM-DD"),
        dayjs(lastDay).format("YYYY-MM-DD"),
      );
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
  const startKey = dayjs(range.start).format("YYYY-MM-DD");
  const endKey = dayjs(range.end).format("YYYY-MM-DD");
  return date >= startKey && date <= endKey;
}
