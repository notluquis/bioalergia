import { queryOptions } from "@tanstack/react-query";

import { fetchDoctoraliaCalendarMonthlySummary } from "@/features/doctoralia/api";

export const doctoraliaAnalyticsKeys = {
  all: ["doctoralia-analytics"] as const,
  monthlySummary: (year?: number) =>
    queryOptions({
      queryFn: () => fetchDoctoraliaCalendarMonthlySummary(year),
      queryKey: ["doctoralia-analytics", "calendar-monthly-summary", year],
    }),
};
