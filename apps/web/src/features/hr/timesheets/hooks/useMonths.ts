import { useQuery } from "@tanstack/react-query";

import { fetchTimesheetMonths } from "../api";

export function useMonths() {
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["timesheet-months"],
    queryFn: fetchTimesheetMonths,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fallback constant
  const fallbackData = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthsFallback = Array.from({ length: 10 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    });
    return {
      months: monthsFallback,
      monthsWithData: new Set<string>(),
    };
  })();

  const months: string[] = data?.months || fallbackData.months;
  const monthsWithData: Set<string> = data?.monthsWithData || fallbackData.monthsWithData;
  const error = queryError instanceof Error ? queryError.message : null;

  return { months, monthsWithData, loading, error };
}
