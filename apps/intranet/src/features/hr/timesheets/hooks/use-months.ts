import { useSuspenseQuery } from "@tanstack/react-query";

import { timesheetAuditKeys } from "@/features/hr/timesheets-audit/queries";
import { fetchTimesheetMonths } from "../api";

export function useMonths() {
  const { data } = useSuspenseQuery({
    queryFn: fetchTimesheetMonths,
    queryKey: timesheetAuditKeys.months(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fallback constant (though Suspense ensures data exists if successful)
  const months = data?.months || [];
  const monthsWithData = data?.monthsWithData || new Set<string>();

  return { months, monthsWithData };
}
