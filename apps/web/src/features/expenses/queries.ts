import { queryOptions } from "@tanstack/react-query";
import { fetchMonthlyExpenseDetail, fetchMonthlyExpenseStats, fetchMonthlyExpenses } from "./api";
import type { ExpenseFilters } from "./hooks/use-monthly-expenses";

export const expenseKeys = {
  all: ["monthly-expenses"] as const,
  detail: (id: string) =>
    queryOptions({
      enabled: !!id,
      queryFn: () => fetchMonthlyExpenseDetail(id),
      queryKey: ["monthly-expense-detail", id],
    }),
  list: (filters: ExpenseFilters) =>
    queryOptions({
      queryFn: async () => {
        const response = await fetchMonthlyExpenses({
          from: filters.from,
          to: filters.to,
        });
        // We handle normalization in the hook or passing a select here.
        // But for useSuspenseQuery, simple raw data return is better and select later,
        // or normalize here. Code used map(normalizeExpense).
        // Let's return raw and let hook handle it? Or normalize here.
        // Hook logic: response.expenses.map((e) => normalizeExpense(e))
        // Let's just return the response and select in the hook if needed,
        // OR standard is to return the data the component expects.
        // The API returns { expenses: ... }.
        return response;
      },
      queryKey: ["monthly-expenses", filters.from, filters.to],
    }),
  stats: (filters: ExpenseFilters) =>
    queryOptions({
      queryFn: async () => {
        const response = await fetchMonthlyExpenseStats({
          category: filters.category ?? undefined,
          from: filters.from,
          groupBy: "month",
          to: filters.to,
        });
        return response;
      },
      queryKey: ["monthly-expenses-stats", filters.from, filters.to, filters.category],
    }),
  statsAll: ["monthly-expenses-stats"] as const,
};
