import { queryOptions } from "@tanstack/react-query";

import { fetchDoctoraliaEmailMonthlySummary } from "@/features/doctoralia/api";

export const doctoraliaAnalyticsKeys = {
  all: ["doctoralia-analytics"] as const,
  monthlySummary: (year?: number) =>
    queryOptions({
      queryFn: () => fetchDoctoraliaEmailMonthlySummary(year),
      queryKey: ["doctoralia-analytics", "monthly-summary", year],
    }),
};
