import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/auth-context";
import { useSettings } from "../context/settings-context";
import { logger } from "../lib/logger";
import { TransactionsFilters } from "../features/transactions/components/TransactionsFilters";
import { TransactionsColumnToggles } from "../features/transactions/components/TransactionsColumnToggles";
import { TransactionsTable } from "../features/transactions/components/TransactionsTable";
import { DailyBalancesPanel } from "../features/balances/components/DailyBalancesPanel";
import { COLUMN_DEFS, type ColumnKey } from "../features/transactions/constants";
import type { Filters } from "../features/transactions/types";
import type { BalancesApiResponse, BalanceDraft } from "../features/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "../features/balances/utils";
import { useQuickDateRange } from "../features/balances/hooks/useQuickDateRange";
import { useDailyBalanceManagement } from "../features/balances/hooks/useDailyBalanceManagement";
import { useTransactionData } from "../features/transactions/hooks/useTransactionData";
import { useLedger } from "../features/transactions/hooks/useLedger";
import Alert from "../components/Alert";
import Input from "../components/Input";
import Button from "../components/Button";
import Checkbox from "../components/Checkbox";
import { fetchBalances } from "../features/balances/api";

export default function Data() {
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [initialBalanceEdited, setInitialBalanceEdited] = useState(false);
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
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFS.map((column) => column.key))
  );

  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find(({ from: start, to: end }) => start === filters.from && end === filters.to);
    return match ? match.value : "custom";
  }, [quickMonths, filters.from, filters.to]);

  const { hasRole } = useAuth();
  const { settings } = useSettings();

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const loadBalances = useCallback(async (fromValue: string, toValue: string) => {
    if (!fromValue || !toValue) {
      setBalancesReport(null);
      return;
    }

    setBalancesLoading(true);
    try {
      const payload = await fetchBalances(fromValue, toValue);
      setBalancesReport(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los saldos diarios";
      logger.warn("balances:load:error", message);
      setBalancesReport(null);
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const {
    drafts: balancesDrafts,
    saving: balancesSaving,
    error: balancesError,
    handleDraftChange: handleBalanceDraftChange,
    handleSave: handleBalanceSave,
    setDrafts: setBalancesDrafts,
  } = useDailyBalanceManagement({
    from: filters.from,
    to: filters.to,
    loadBalances,
  });

  const { rows, setRows, loading, error, hasAmounts, page, pageSize, total, refresh, setPageSize, setPage } =
    useTransactionData({
      canView,
      loadBalances,
    });

  const ledger = useLedger({
    rows,
    initialBalance,
    hasAmounts,
  });

  useEffect(() => {
    if (canView) {
      refresh(filters, 1, pageSize);
    } else {
      setRows([]);
    }
  }, [canView, filters, pageSize, refresh, setRows]);

  useEffect(() => {
    if (!balancesReport) {
      setBalancesDrafts({});
      return;
    }

    const drafts: Record<string, BalanceDraft> = {};
    for (const day of balancesReport.days) {
      drafts[day.date] = {
        value: day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "",
        note: day.note ?? "",
      };
    }
    setBalancesDrafts(drafts);
  }, [balancesReport, setBalancesDrafts]);

  useEffect(() => {
    if (!balancesReport || initialBalanceEdited) {
      return;
    }

    const derived = deriveInitialBalance(balancesReport);
    if (derived == null) {
      const hasRecorded = balancesReport.days.some((day) => day.recordedBalance != null);
      if (!balancesReport.previous && !hasRecorded && initialBalance !== "0") {
        setInitialBalance("0");
      }
      return;
    }

    const formatted = formatBalanceInput(derived);
    if (formatted !== initialBalance) {
      setInitialBalance(formatted);
    }
  }, [balancesReport, initialBalance, initialBalanceEdited]);

  const handleFilterChange = (update: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...update }));
    if (Object.prototype.hasOwnProperty.call(update, "from") || Object.prototype.hasOwnProperty.call(update, "to")) {
      setInitialBalanceEdited(false);
    }
  };

  const handleResetInitialBalance = useCallback(() => {
    if (!balancesReport) return;
    const derived = deriveInitialBalance(balancesReport);
    if (derived == null) return;
    const formatted = formatBalanceInput(derived);
    setInitialBalance(formatted);
    setInitialBalanceEdited(false);
  }, [balancesReport]);

  return (
    <section className="space-y-6">
      {!canView ? (
        <Alert variant="error">No tienes permisos para ver los movimientos almacenados.</Alert>
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-(--brand-primary)">Movimientos en la base</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Los datos provienen de la tabla <code>mp_transactions</code>. Ajusta el saldo inicial para recalcular el
                saldo acumulado. Para consultas o soporte, escribe a<strong> {settings.supportEmail}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Saldo inicial (CLP)"
                type="text"
                value={initialBalance}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setInitialBalanceEdited(true);
                  setInitialBalance(event.target.value);
                }}
                placeholder="0"
                className="w-fit"
              />
              <Button
                variant="secondary"
                onClick={handleResetInitialBalance}
                disabled={!balancesReport || balancesLoading}
              >
                Usar saldo diario
              </Button>
              <Input
                label="Mes rápido"
                type="select"
                value={quickRange}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  const value = event.target.value;
                  if (value === "custom") return;
                  const match = quickMonths.find((month) => month.value === value);
                  if (!match) return;
                  const nextFilters = { ...filters, from: match.from, to: match.to };
                  setFilters(nextFilters);
                  setInitialBalanceEdited(false);
                  setPage(1);
                  refresh(nextFilters, 1, pageSize);
                }}
                className="w-fit"
              >
                <option value="custom">Personalizado</option>
                {quickMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </Input>
              <Button onClick={() => refresh(filters, page, pageSize)} disabled={loading}>
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
              <Checkbox
                label="Mostrar montos"
                checked={filters.includeAmounts}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextFilters = { ...filters, includeAmounts: event.target.checked };
                  setFilters(nextFilters);
                  logger.info("[data] toggle includeAmounts", nextFilters.includeAmounts);
                  refresh(nextFilters, page, pageSize);
                }}
              />
            </div>
          </div>

          <DailyBalancesPanel
            report={balancesReport}
            drafts={balancesDrafts}
            onDraftChange={handleBalanceDraftChange}
            onSave={handleBalanceSave}
            saving={balancesSaving}
            loading={balancesLoading}
            error={balancesError}
          />

          {error && <Alert variant="error">{error}</Alert>}

          <TransactionsTable
            rows={ledger}
            loading={loading}
            hasAmounts={hasAmounts}
            total={total}
            page={page}
            pageSize={pageSize}
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
