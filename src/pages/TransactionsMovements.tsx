import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { coerceAmount } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import { isCashbackCandidate } from "../../shared/cashback";
import { TransactionsFilters } from "../features/transactions/components/TransactionsFilters";
import { TransactionsColumnToggles } from "../features/transactions/components/TransactionsColumnToggles";
import { TransactionsTable } from "../features/transactions/components/TransactionsTable";
import { COLUMN_DEFS, type ColumnKey } from "../features/transactions/constants";
import type { DbMovement, Filters, LedgerRow } from "../features/transactions/types";

const DEFAULT_PAGE_SIZE = 50;

type ApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  hasAmounts?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

export default function TransactionsMovements() {
  const [rows, setRows] = useState<DbMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [filters, setFilters] = useState<Filters>({
    from: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    description: "",
    sourceId: "",
    origin: "",
    destination: "",
    direction: "",
    includeAmounts: false,
  });
  const [hasAmounts, setHasAmounts] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFS.map((column) => column.key))
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const quickMonths = useMemo(() => {
    const months: Array<{ value: string; label: string; from: string; to: string }> = [];
    for (let i = 0; i < 12; i++) {
      const date = dayjs().subtract(i, "month").startOf("month");
      const label = date.format("MMMM YYYY");
      const start = date.format("YYYY-MM-DD");
      const end = date.endOf("month").format("YYYY-MM-DD");
      months.push({ value: start, label, from: start, to: end });
    }
    return months;
  }, []);

  const quickRange = useMemo(() => {
    const match = quickMonths.find(({ from: start, to: end }) => start === filters.from && end === filters.to);
    return match ? match.value : "custom";
  }, [quickMonths, filters.from, filters.to]);

  const { hasRole } = useAuth();
  const { settings } = useSettings();

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const initialBalanceNumber = useMemo(() => coerceAmount(initialBalance), [initialBalance]);

  useEffect(() => {
    if (canView) {
      refresh(filters, 1, pageSize);
    } else {
      setRows([]);
    }
  }, [canView]);

  const ledger = useMemo<LedgerRow[]>(() => {
    let balance = initialBalanceNumber;
    const chronological = rows
      .slice()
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
      .map((row) => {
        const amount = row.amount ?? 0;
        const delta = isCashbackCandidate(row)
          ? 0
          : row.direction === "IN"
            ? amount
            : row.direction === "OUT"
              ? -amount
              : 0;
        if (hasAmounts) {
          balance += delta;
        }
        return {
          ...row,
          runningBalance: hasAmounts ? balance : 0,
          delta,
        };
      });

    return chronological.reverse();
  }, [rows, initialBalanceNumber, hasAmounts]);

  const refresh = useCallback(
    async (next: Filters, nextPage = page, nextPageSize = pageSize) => {
      if (!canView) {
        setRows([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        logger.info("[movements] fetch:start", {
          filters: next,
          page: nextPage,
          pageSize: nextPageSize,
        });
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

        const res = await fetch(`/api/transactions?${params.toString()}`, {
          credentials: "include",
        });
        const payload = (await res.json()) as ApiResponse;
        if (!res.ok || payload.status !== "ok") {
          throw new Error(payload.message || "No se pudieron obtener los movimientos");
        }
        setRows(payload.data);
        setHasAmounts(Boolean(payload.hasAmounts));
        setTotal(payload.total ?? payload.data.length);
        setPage(payload.page ?? nextPage);
        setPageSize(payload.pageSize ?? nextPageSize);
        logger.info("[movements] fetch:success", {
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
        logger.error("[movements] fetch:error", message);
      } finally {
        setLoading(false);
      }
    },
    [canView, page, pageSize]
  );

  const handleFilterChange = (update: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...update }));
  };

  return (
    <section className="space-y-6">
      {!canView ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm">
          No tienes permisos para ver los movimientos almacenados.
        </div>
      ) : (
        <>
          <TransactionsFilters
            filters={filters}
            loading={loading}
            onChange={handleFilterChange}
            onSubmit={() => {
              setPage(1);
              refresh(filters, 1, pageSize);
            }}
          />

          <TransactionsColumnToggles
            visibleColumns={visibleColumns}
            onToggle={(column) => {
              setVisibleColumns((prev) => {
                const next = new Set(prev);
                if (next.has(column)) next.delete(column);
                else next.add(column);
                return next;
              });
            }}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Movimientos en base</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Los datos provienen de la tabla <code>mp_transactions</code>. Ajusta el saldo inicial para recalcular el
                saldo acumulado. Para consultas o soporte escribe a<strong> {settings.supportEmail}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Saldo inicial (CLP)
                <input
                  type="text"
                  value={initialBalance}
                  onChange={(event) => setInitialBalance(event.target.value)}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mes rápido
                <select
                  value={quickRange}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    const nextFilters = { ...filters, from: match.from, to: match.to };
                    setFilters(nextFilters);
                    setPage(1);
                    refresh(nextFilters, 1, pageSize);
                  }}
                  className="rounded border px-2 py-1"
                >
                  <option value="custom">Personalizado</option>
                  {quickMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => refresh(filters, page, pageSize)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--brand-primary)", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.includeAmounts}
                  onChange={(event) => {
                    const nextFilters = { ...filters, includeAmounts: event.target.checked };
                    setFilters(nextFilters);
                    logger.info("[movements] toggle includeAmounts", nextFilters.includeAmounts);
                    refresh(nextFilters, page, pageSize);
                  }}
                />
                Mostrar montos
              </label>
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <TransactionsTable
            rows={ledger}
            loading={loading}
            hasAmounts={hasAmounts}
            total={total}
            onPageChange={(nextPage: number) => {
              setPage(nextPage);
              refresh(filters, nextPage, pageSize);
            }}
            onPageSizeChange={(nextPageSize: number) => {
              setPageSize(nextPageSize);
              setPage(1);
              refresh(filters, 1, nextPageSize);
            }}
          />
        </>
      )}
    </section>
  );
}
