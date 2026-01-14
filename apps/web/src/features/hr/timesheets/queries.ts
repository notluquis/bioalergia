import { queryOptions } from "@tanstack/react-query";

import { fetchTimesheetMonths } from "./api";

export const timesheetKeys = {
  all: ["timesheets"] as const,
  months: () => ["timesheet-months"] as const, // Legacy key maintained for now
};

export const timesheetQueries = {
  months: () =>
    queryOptions({
      queryKey: timesheetKeys.months(),
      queryFn: fetchTimesheetMonths,
      staleTime: 1000 * 60 * 5,
    }),
};
