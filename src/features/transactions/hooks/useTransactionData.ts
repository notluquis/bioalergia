import { useState, useCallback } from "react";
import { logger } from "../../../lib/logger";
import type { Filters, DbMovement, ApiResponse } from "../types";
import { apiClient } from "../../../lib/apiClient";

interface UseTransactionDataProps {
  canView: boolean;
  loadBalances: (from: string, to: string) => Promise<void>;
}

export function useTransactionData({ canView, loadBalances }: UseTransactionDataProps) {
  const [rows, setRows] = useState<DbMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAmounts, setHasAmounts] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(
    async (next: Filters, nextPage = page, nextPageSize = pageSize) => {
      if (!canView) {
        setRows([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        logger.info("[data] fetch:start", { filters: next, page: nextPage, pageSize: nextPageSize });
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("pageSize", String(nextPageSize));
        if (next.from) params.set("from", next.from);
        if (next.to) params.set("to", next.to);
        if (next.description) params.set("description", next.description);
        if (next.sourceId) params.set("sourceId", next.sourceId);
        if (next.origin) params.set("origin", next.origin);
        if (next.destination) params.set("destination", next.destination);
        if (next.direction) params.set("direction", next.direction);
        if (next.includeAmounts) params.set("includeAmounts", "true");

        const payload = await apiClient.get<ApiResponse>(`/api/transactions?${params.toString()}`);

        setRows(payload.data);
        setHasAmounts(Boolean(payload.hasAmounts));
        setTotal(payload.total ?? payload.data.length);
        setPage(payload.page ?? nextPage);
        setPageSize(payload.pageSize ?? nextPageSize);
        await loadBalances(next.from, next.to);
        logger.info("[data] fetch:success", {
          rows: payload.data.length,
          hasAmounts: Boolean(payload.hasAmounts),
          total: payload.total,
          page: payload.page,
          pageSize: payload.pageSize,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado al cargar";
        setError(message);
        setRows([]);
        setHasAmounts(false);
        logger.error("[data] fetch:error", message);
      } finally {
        setLoading(false);
      }
    },
    [canView, page, pageSize, loadBalances]
  );

  return {
    rows,
    setRows,
    loading,
    error,
    hasAmounts,
    page,
    pageSize,
    total,
    refresh,
    setPageSize,
    setPage,
  };
}
