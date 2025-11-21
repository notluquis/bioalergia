import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import { DailyBalancesPanel } from "../features/balances/components/DailyBalancesPanel";
import { BalanceSummary } from "../features/balances/components/BalanceSummary";
import type { BalanceDraft, BalancesApiResponse } from "../features/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "../features/balances/utils";
import { useQuickDateRange } from "../features/balances/hooks/useQuickDateRange";
import { useDailyBalanceManagement } from "../features/balances/hooks/useDailyBalanceManagement";
import { fetchBalances } from "../features/balances/api";
import Alert from "../components/ui/Alert";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function DailyBalances() {
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  // canEdit flag removed (unused)

  const [from, setFrom] = useState(dayjs().subtract(10, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  const balancesQuery = useQuery<BalancesApiResponse, Error>({
    queryKey: ["daily-balances", from, to],
    queryFn: async () => {
      logger.info("[balances] fetch:start", { from, to });
      const payload = await fetchBalances(from, to);
      logger.info("[balances] fetch:success", { days: payload.days.length });
      return payload;
    },
    placeholderData: keepPreviousData,
  });

  const { data, isFetching, isLoading, error: balancesQueryError, refetch } = balancesQuery;
  const report = data ?? null;
  const isInitialLoading = isLoading && !report;
  const balancesError = balancesQueryError instanceof Error ? balancesQueryError.message : null;

  const reloadBalances = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { drafts, saving, error, handleDraftChange, handleSave, setDrafts } = useDailyBalanceManagement({
    loadBalances: reloadBalances,
  });

  useEffect(() => {
    if (!report) {
      setDrafts({});
      return;
    }
    const nextDrafts: Record<string, BalanceDraft> = {};
    for (const day of report.days) {
      nextDrafts[day.date] = {
        value: day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "",
        note: day.note ?? "",
      };
    }
    setDrafts(nextDrafts);
  }, [report, setDrafts]);

  const derivedInitial = useMemo(() => (report ? deriveInitialBalance(report) : null), [report]);

  return (
    <section className="space-y-6">
      {!hasRole("GOD", "ADMIN", "ANALYST", "VIEWER") ? (
        <Alert variant="error">No tienes permisos para ver los saldos diarios.</Alert>
      ) : (
        <>
          <div className="bg-base-100 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-primary drop-shadow-sm">Saldos diarios</h1>
              <p className="max-w-2xl text-sm text-base-content/70">
                Registra el saldo de la cuenta a las 23:59 de cada día para conciliar los movimientos almacenados en{" "}
                <code>mp_transactions</code>. Para consultas, escribe a<strong> {settings.supportEmail}</strong>.
              </p>
              {derivedInitial != null && (
                <p className="text-xs text-base-content/60">
                  Saldo anterior calculado: <strong>{formatBalanceInput(derivedInitial)}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Fecha desde"
                type="date"
                value={from}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value)}
                className="w-fit"
              />
              <Input
                label="Fecha hasta"
                type="date"
                value={to}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value)}
                className="w-fit"
              />
              <Input
                label="Mes rápido"
                as="select"
                value={quickRange}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  const value = event.target.value;
                  if (value === "custom") return;
                  const match = quickMonths.find((month) => month.value === value);
                  if (!match) return;
                  setFrom(match.from);
                  setTo(match.to);
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
              <Button onClick={() => refetch()} disabled={isFetching} size="sm">
                {isFetching ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <BalanceSummary report={report} loading={isFetching} error={balancesError} />

          <DailyBalancesPanel
            report={report}
            drafts={drafts}
            onDraftChange={handleDraftChange}
            onSave={handleSave}
            saving={saving}
            loading={isInitialLoading}
            error={error}
          />
        </>
      )}
    </section>
  );
}
