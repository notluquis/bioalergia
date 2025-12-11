import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { DailyBalancesPanel } from "@/features/finance/balances/components/DailyBalancesPanel";
import { BalanceSummary } from "@/features/finance/balances/components/BalanceSummary";
import type { BalanceDraft, BalancesApiResponse } from "@/features/finance/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "@/features/finance/balances/utils";
import { useQuickDateRange } from "@/features/finance/balances/hooks/useQuickDateRange";
import { useDailyBalanceManagement } from "@/features/finance/balances/hooks/useDailyBalanceManagement";
import { fetchBalances } from "@/features/finance/balances/api";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function DailyBalances() {
  const { hasRole } = useAuth();
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
    <section className="mx-auto max-w-7xl space-y-6">
      {!hasRole("GOD", "ADMIN", "ANALYST", "VIEWER") ? (
        <Alert variant="error">No tienes permisos para ver los saldos diarios.</Alert>
      ) : (
        <>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <h1 className="text-primary text-2xl font-bold">Saldos diarios</h1>
                  <p className="text-base-content/70 text-sm">
                    Registra el saldo de cierre diario para conciliar movimientos.
                    {derivedInitial != null && (
                      <span className="ml-2 text-xs font-medium">
                        Saldo anterior: <strong>{formatBalanceInput(derivedInitial)}</strong>
                      </span>
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="Desde"
                    type="date"
                    value={from}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value)}
                  />
                  <Input
                    label="Hasta"
                    type="date"
                    value={to}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value)}
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
                  >
                    <option value="custom">Personalizado</option>
                    {quickMonths.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </Input>
                  <div className="flex items-end">
                    <Button onClick={() => refetch()} disabled={isFetching} className="w-full">
                      {isFetching ? "Actualizando..." : "Actualizar"}
                    </Button>
                  </div>
                </div>
              </div>
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
