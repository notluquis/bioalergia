import { queryOptions } from "@tanstack/react-query";

import { fetchTimesheetMonths } from "./api";

export const timesheetKeys = {
  all: ["timesheets"] as const,
  months: () => ["timesheets", "months"] as const,
};

export const timesheetQueries = {
  months: () =>
    queryOptions({
      queryFn: fetchTimesheetMonths,
      queryKey: timesheetKeys.months(),
      staleTime: 1000 * 60 * 5,
    }),
};
