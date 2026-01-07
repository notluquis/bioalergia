import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchBalances } from "@/features/finance/balances/api";
import { DailyBalancesPanel } from "@/features/finance/balances/components/DailyBalancesPanel";
import { useDailyBalanceManagement } from "@/features/finance/balances/hooks/useDailyBalanceManagement";
import type { BalanceDraft, BalancesApiResponse } from "@/features/finance/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "@/features/finance/balances/utils";
import { TransactionsColumnToggles } from "@/features/finance/transactions/components/TransactionsColumnToggles";
import { TransactionsFilters } from "@/features/finance/transactions/components/TransactionsFilters";
import { TransactionsTable } from "@/features/finance/transactions/components/TransactionsTable";
import { COLUMN_DEFS, type ColumnKey } from "@/features/finance/transactions/constants";
import { useLedger } from "@/features/finance/transactions/hooks/useLedger";
import { useTransactionsQuery } from "@/features/finance/transactions/hooks/useTransactionsQuery";
import type { Filters } from "@/features/finance/transactions/types";
import { today } from "@/lib/dates";
import { logger } from "@/lib/logger";

const DEFAULT_PAGE_SIZE = 50;

export default function TransactionsMovements() {
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [initialBalanceEdited, setInitialBalanceEdited] = useState(false);
  const [debouncedInitialBalance] = useDebounce(initialBalance, 500);
  const [draftFilters, setDraftFilters] = useState<Filters>({
    from: dayjs().startOf("year").format("YYYY-MM-DD"),
    to: today(),
    description: "",
    sourceId: "",
    externalReference: "",
    transactionType: "",
    status: "",
    bankAccountNumber: "",
    origin: "",
    destination: "",
    direction: "",
    includeAmounts: false,
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(draftFilters);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFS.map((column) => column.key))
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const quickMonths = (() => {
    const months: Array<{ value: string; label: string; from: string; to: string }> = [];
    for (let i = 0; i < 12; i++) {
      const date = dayjs().subtract(i, "month").startOf("month");
      const label = date.format("MMMM YYYY");
      const start = date.format("YYYY-MM-DD");
      const end = date.endOf("month").format("YYYY-MM-DD");
      months.push({ value: start, label, from: start, to: end });
    }
    return months;
  })();

  const quickRange = (() => {
    const match = quickMonths.find(
      ({ from: start, to: end }) => start === draftFilters.from && end === draftFilters.to
    );
    return match ? match.value : "custom";
  })();

  const { can } = useAuth();
  const { settings } = useSettings();
  const canView = can("read", "Transaction");

  const queryParams = {
    filters: appliedFilters,
    page,
    pageSize,
  };

  const transactionsQuery = useTransactionsQuery(queryParams);

  const rows = transactionsQuery.data?.data ?? [];
  const hasAmounts = Boolean(transactionsQuery.data?.hasAmounts);
  const total = transactionsQuery.data?.total ?? rows.length;
  const loading = transactionsQuery.isPending || transactionsQuery.isFetching;
  const error = transactionsQuery.error?.message ?? null;

  const ledger = useLedger({
    rows,
    initialBalance: debouncedInitialBalance,
    hasAmounts,
  });

  // Load balances
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
      logger.error("[transactions] balances:error", message);
      setBalancesReport(null);
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  // Daily balance management
  const {
    drafts: balancesDrafts,
    saving: balancesSaving,
    error: balancesError,
    handleDraftChange: handleBalanceDraftChange,
    handleSave: handleBalanceSave,
    setDrafts: setBalancesDrafts,
  } = useDailyBalanceManagement({
    loadBalances: async () => {
      await loadBalances(appliedFilters.from, appliedFilters.to);
    },
  });

  // Load balances when filters change
  useEffect(() => {
    if (!canView) return;

    async function loadAndUpdateDrafts() {
      await loadBalances(appliedFilters.from, appliedFilters.to);
    }

    loadAndUpdateDrafts();
  }, [appliedFilters.from, appliedFilters.to, canView, loadBalances]);

  // Update drafts when balances report changes
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

    // Derive initial balance if not manually edited
    if (!initialBalanceEdited) {
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
    }
  }, [balancesReport, setBalancesDrafts, initialBalance, initialBalanceEdited]);

  const handleFilterChange = (update: Partial<Filters>) => {
    setDraftFilters((prev) => ({ ...prev, ...update }));
    // Reset initial balance edited flag when date range changes
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
    <section className="mx-auto w-full max-w-none space-y-4 p-4">
      {!canView ? (
        <div className="card bg-base-100 border-error/20 border p-0 shadow-sm">
          <Alert variant="error">No tienes permisos para ver los movimientos almacenados.</Alert>
        </div>
      ) : (
        <>
          <TransactionsFilters
            filters={draftFilters}
            loading={loading}
            onChange={handleFilterChange}
            onSubmit={() => {
              setPage(1);
              setAppliedFilters({ ...draftFilters });
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
              <h1 className="typ-title text-base-content">Movimientos en base</h1>
              <p className="typ-body text-base-content/70 max-w-2xl">
                Los datos provienen de la tabla <code>transactions</code> (Mercado Pago). Ajusta el saldo inicial para
                recalcular el saldo acumulado.
                {settings.supportEmail && (
                  <>
                    {" "}
                    Para consultas o soporte escribe a <strong>{settings.supportEmail}</strong>.
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-base-content text-xs font-semibold tracking-wide uppercase">
                  Saldo inicial (CLP)
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={initialBalance}
                    onChange={(event) => {
                      setInitialBalance(event.target.value);
                      setInitialBalanceEdited(true);
                    }}
                    className="input-sm bg-base-100/90 w-32"
                    placeholder="0"
                    inputMode="decimal"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetInitialBalance}
                    disabled={!balancesReport}
                    title="Restablecer al saldo calculado"
                  >
                    ↻
                  </Button>
                </div>
              </div>
              <div className="flex w-40 flex-col gap-1">
                <span className="text-base-content text-xs font-semibold tracking-wide uppercase">Mes rápido</span>
                <Input
                  as="select"
                  value={quickRange}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    const nextFilters = { ...draftFilters, from: match.from, to: match.to };
                    setDraftFilters(nextFilters);
                    setPage(1);
                    setAppliedFilters(nextFilters);
                  }}
                  className="select-sm bg-base-100/90"
                >
                  <option value="custom">Personalizado</option>
                  {quickMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </Input>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => transactionsQuery.refetch()}
                disabled={loading}
                size="sm"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
              <div className="pb-1">
                <Checkbox
                  label="Mostrar montos"
                  checked={draftFilters.includeAmounts}
                  onChange={(event) => {
                    const nextFilters = { ...draftFilters, includeAmounts: event.target.checked };
                    setDraftFilters(nextFilters);
                    logger.info("[movements] toggle includeAmounts", nextFilters.includeAmounts);
                    setPage(1);
                    setAppliedFilters(nextFilters);
                  }}
                />
              </div>
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
            onPageChange={(nextPage: number) => {
              setPage(nextPage);
            }}
            onPageSizeChange={(nextPageSize: number) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />

          {/* Daily Balances Panel */}
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
