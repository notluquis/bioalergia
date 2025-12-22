import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export function useMonths() {
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["timesheet-months"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ status: string; months: string[]; monthsWithData: string[] }>(
          "/api/timesheets/months"
        );
        if (response.status === "ok" && Array.isArray(response.months)) {
          return {
            months: response.months,
            monthsWithData: new Set(response.monthsWithData || []),
          };
        }
        return null; // Trigger fallback
      } catch {
        throw new Error("No se pudieron cargar los meses");
      }
    },
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
