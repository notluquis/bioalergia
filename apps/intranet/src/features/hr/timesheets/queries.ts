import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { fetchTimesheetDetail, fetchTimesheetMonths, fetchTimesheetSummary } from "./api";

export const timesheetKeys = {
  all: ["timesheets"] as const,
  detail: (employeeId: number, month: string) =>
    ["timesheets", "detail", employeeId, month] as const,
  months: () => ["timesheets", "months"] as const,
  summary: (month: string) => ["timesheets", "summary", month] as const,
};

export const timesheetQueries = {
  detail: (employeeId: number, month: string) =>
    queryOptions({
      queryFn: () => fetchTimesheetDetail(employeeId, month),
      queryKey: timesheetKeys.detail(employeeId, month),
    }),
  months: () =>
    queryOptions({
      queryFn: fetchTimesheetMonths,
      queryKey: timesheetKeys.months(),
      staleTime: 1000 * 60 * 5,
    }),
  summary: (month: string, employeeId?: null | number) =>
    queryOptions({
      placeholderData: keepPreviousData,
      queryFn: () => fetchTimesheetSummary(month, employeeId),
      queryKey: timesheetKeys.summary(month),
    }),
};
