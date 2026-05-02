import { queryOptions } from "@tanstack/react-query";
import { fetchExpenseDetail, fetchExpenses, fetchExpenseServices, fetchExpenseStats } from "./api";
import type { ExpenseScope, ExpenseStatus } from "./types";

export interface ExpenseListFilters {
  from?: string;
  scope?: ExpenseScope;
  serviceId?: null | number;
  status?: ExpenseStatus;
  to?: string;
}

export interface ExpenseStatsFilters {
  from?: string;
  groupBy?: "month" | "quarter" | "year";
  scope?: ExpenseScope;
  to?: string;
}

export interface ExpenseServiceFilters {
  isActive?: boolean;
  scope?: ExpenseScope;
}

// Keep backward compat alias used in the existing hook
export type ExpenseFilters = ExpenseListFilters & { category?: null | string };

export const expenseKeys = {
  all: ["expenses"] as const,
  allServices: ["expense-services"] as const,
  allStats: ["expense-stats"] as const,

  detail: (publicId: string) =>
    queryOptions({
      enabled: Boolean(publicId),
      queryFn: () => fetchExpenseDetail(publicId),
      queryKey: ["expense-detail", publicId] as const,
    }),

  list: (filters: ExpenseListFilters) =>
    queryOptions({
      queryFn: () =>
        fetchExpenses({
          from: filters.from,
          scope: filters.scope,
          serviceId: filters.serviceId,
          status: filters.status,
          to: filters.to,
        }),
      queryKey: [
        "expenses",
        filters.from,
        filters.to,
        filters.scope,
        filters.status,
        filters.serviceId,
      ] as const,
    }),

  services: (filters: ExpenseServiceFilters = {}) =>
    queryOptions({
      queryFn: () => fetchExpenseServices(filters),
      queryKey: ["expense-services", filters.isActive, filters.scope] as const,
    }),

  stats: (filters: ExpenseStatsFilters) =>
    queryOptions({
      queryFn: () =>
        fetchExpenseStats({
          from: filters.from,
          groupBy: filters.groupBy ?? "month",
          scope: filters.scope,
          to: filters.to,
        }),
      queryKey: [
        "expense-stats",
        filters.from,
        filters.to,
        filters.scope,
        filters.groupBy,
      ] as const,
    }),
};
