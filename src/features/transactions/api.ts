import { apiClient } from "../../lib/apiClient";
import type { Filters, DbMovement } from "./types";

export type TransactionsApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  hasAmounts?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

export type TransactionsQueryParams = {
  filters: Filters;
  page: number;
  pageSize: number;
};

export async function fetchTransactions({ filters, page, pageSize }: TransactionsQueryParams) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.description) params.set("description", filters.description);
  if (filters.sourceId) params.set("sourceId", filters.sourceId);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.destination) params.set("destination", filters.destination);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.includeAmounts) params.set("includeAmounts", "true");

  const payload = await apiClient.get<TransactionsApiResponse>(`/api/transactions?${params.toString()}`);
  if (payload.status !== "ok") {
    throw new Error(payload.message ?? "No se pudieron obtener los movimientos");
  }
  return payload;
}
