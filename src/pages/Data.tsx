import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import {
  TransactionsFilters,
} from "../features/transactions/components/TransactionsFilters";
import {
  TransactionsColumnToggles,
} from "../features/transactions/components/TransactionsColumnToggles";
import { TransactionsTable } from "../features/transactions/components/TransactionsTable";
import { DailyBalancesPanel } from "../features/balances/components/DailyBalancesPanel";
import { COLUMN_DEFS, type ColumnKey } from "../features/transactions/constants";
import type { Filters, LedgerRow } from "../features/transactions/types";
import type { BalancesApiResponse, BalanceDraft } from "../features/balances/types";
import {
  deriveInitialBalance,
  formatBalanceInput,
} from "../features/balances/utils";
import { useQuickDateRange } from "../features/balances/hooks/useQuickDateRange";
import { useDailyBalanceManagement } from "../features/balances/hooks/useDailyBalanceManagement";
import { useLedger } from "../features/transactions/hooks/useLedger";
import Alert from "../components/Alert";
import Input from "../components/Input";
import Button from "../components/Button";
import Checkbox from "../components/Checkbox";
import { fetchBalances } from "../features/balances/api";
import { useTransactionsQuery } from "../features/transactions/hooks/useTransactionsQuery";

const DEFAULT_PAGE_SIZE = 50;

export default function Data() {
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [initialBalanceEdited, setInitialBalanceEdited] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>({
    from: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    description: "",
    sourceId: "",
    origin: "",
    destination: "",
    direction: "",
    includeAmounts: false,
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(draftFilters);
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFS.map((column) => column.key))
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find(
      ({ from: start, to: end }) => start === draftFilters.from && end === draftFilters.to
    );
    return match ? match.value : "custom";
  }, [quickMonths, draftFilters.from, draftFilters.to]);

  const { hasRole } = useAuth();
  const { settings } = useSettings();

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const loadBalances = useCallback(
    async (fromValue: string, toValue: string) => {
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
        logger.error("[data] balances:error", message);
        setBalancesReport(null);
      } finally {
        setBalancesLoading(false);
      }
    },
    []
  );

  const { drafts: balancesDrafts, saving: balancesSaving, error: balancesError, handleDraftChange: handleBalanceDraftChange, handleSave: handleBalanceSave, setDrafts: setBalancesDrafts } = useDailyBalanceManagement({
    from: appliedFilters.from,
    to: appliedFilters.to,
    loadBalances,
  });

  const transactionsQuery = useTransactionsQuery(
    { filters: appliedFilters, page, pageSize },
    canView
  );

  const rows = transactionsQuery.data?.data ?? [];
  const hasAmounts = Boolean(transactionsQuery.data?.hasAmounts);
  const total = transactionsQuery.data?.total ?? rows.length;
  const loading = transactionsQuery.isPending || transactionsQuery.isFetching;
  const error = transactionsQuery.error?.message ?? null;

  const ledger = useLedger({
    rows,
    initialBalance,
    hasAmounts,
  });

  useEffect(() => {
    if (!canView) {
      return;
    }
    loadBalances(appliedFilters.from, appliedFilters.to);
  }, [appliedFilters.from, appliedFilters.to, canView, loadBalances]);

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
    setDraftFilters((prev) => ({ ...prev, ...update }));
    if (Object.prototype.hasOwnProperty.call(update, "from") || Object.prototype.hasOwnProperty.call(update, "to")) {
      setInitialBalanceEdited(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters });
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
        <Alert variant="error">
          No tienes permisos para ver los movimientos almacenados.
        </Alert>
      ) : (
        <>
          <TransactionsFilters
            filters={draftFilters}
            loading={loading}
            onChange={handleFilterChange}
            onSubmit={handleApplyFilters}
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
              <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Movimientos en la base</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Saldos ajustados + balance manual para cuadrar con contabilidad. Ajusta el saldo inicial
                para recalcular el saldo acumulado, registra los saldos diarios y, ante dudas, contacta a{" "}
                <strong>{settings.supportEmail}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <label htmlFor="balance-day" className="text-slate-500">
                  Saldo inicial (CLP)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    id="balance-day"
                    type="text"
                    value={initialBalance}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setInitialBalance(event.target.value);
                      setInitialBalanceEdited(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={handleResetInitialBalance}
                    disabled={!balancesReport}
                  >
                    Restablecer
                  </Button>
                </div>
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mes rápido
                <select
                  value={quickRange}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    const nextFilters = { ...draftFilters, from: match.from, to: match.to };
                    setDraftFilters(nextFilters);
                    setInitialBalanceEdited(false);
                    setPage(1);
                    setAppliedFilters(nextFilters);
                  }}
                  className="glass-input"
                >
                  <option value="custom">Personalizado</option>
                  {quickMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                onClick={() => transactionsQuery.refetch()}
                disabled={loading}
                variant="secondary"
                size="sm"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
              <Checkbox
                label="Mostrar montos"
                checked={draftFilters.includeAmounts}
                onChange={(event) => {
                  const nextFilters = { ...draftFilters, includeAmounts: event.target.checked };
                  setDraftFilters(nextFilters);
                  logger.info("[data] toggle includeAmounts", nextFilters.includeAmounts);
                  setPage(1);
                  setAppliedFilters(nextFilters);
                }}
              />
            </div>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <TransactionsTable
            rows={ledger}
            loading={loading}
            hasAmounts={hasAmounts}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={(nextPage) => {
              setPage(nextPage);
            }}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />

          <DailyBalancesPanel
            report={balancesReport}
            drafts={balancesDrafts}
            onDraftChange={handleBalanceDraftChange}
            onSave={handleBalanceSave}
            saving={balancesSaving}
            loading={balancesLoading}
            error={balancesError}
          />
        </>
      )}
    </section>
  );
}
