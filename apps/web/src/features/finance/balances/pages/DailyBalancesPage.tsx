import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import type { BalanceDraft } from "@/features/finance/balances/types";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { BalanceSummary } from "@/features/finance/balances/components/BalanceSummary";
import { DailyBalancesPanel } from "@/features/finance/balances/components/DailyBalancesPanel";
import { useDailyBalanceManagement } from "@/features/finance/balances/hooks/useDailyBalanceManagement";
import { useQuickDateRange } from "@/features/finance/balances/hooks/useQuickDateRange";
import { balanceKeys } from "@/features/finance/balances/queries";
import { deriveInitialBalance, formatBalanceInput } from "@/features/finance/balances/utils";
import { today } from "@/lib/dates";

export default function DailyBalances() {
  const { can } = useAuth();
  // canEdit flag removed (unused)

  const [from, setFrom] = useState(dayjs().subtract(10, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(today());
  const { quickMonths } = useQuickDateRange();

  const quickRange = (() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  })();

  const { data: report, isFetching, refetch } = useSuspenseQuery(balanceKeys.range(from, to));

  const balancesError = null; // Suspense handles errors
  const isInitialLoading = false; // Suspense handles loading

  const reloadBalances = async () => {
    await refetch();
  };

  const { drafts, error, handleDraftChange, handleSave, saving, setDrafts } = useDailyBalanceManagement({
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
        note: day.note ?? "",
        value: day.recordedBalance == null ? "" : formatBalanceInput(day.recordedBalance),
      };
    }
    setDrafts(nextDrafts);
  }, [report, setDrafts]);

  const derivedInitial = report ? deriveInitialBalance(report) : null;

  return (
    <section className="space-y-4">
      {can("read", "DailyBalance") ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-primary text-xl font-semibold">Saldos diarios</h1>
              {derivedInitial != null && (
                <p className="text-base-content/60 text-sm">
                  Saldo anterior: <strong>{formatBalanceInput(derivedInitial)}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="card card-compact bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  className="input-sm"
                  label="Desde"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setFrom(event.target.value);
                  }}
                  type="date"
                  value={from}
                />
                <Input
                  className="input-sm"
                  label="Hasta"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setTo(event.target.value);
                  }}
                  type="date"
                  value={to}
                />
                <Input
                  as="select"
                  className="select-sm"
                  label="Mes rápido"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    setFrom(match.from);
                    setTo(match.to);
                  }}
                  value={quickRange}
                >
                  <option value="custom">Personalizado</option>
                  {quickMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </Input>
                <div className="flex items-end">
                  <Button className="w-full" disabled={isFetching} onClick={() => refetch()} size="sm">
                    {isFetching ? "..." : "Actualizar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <BalanceSummary error={balancesError} loading={isFetching} report={report} />

          <DailyBalancesPanel
            drafts={drafts}
            error={error}
            loading={isInitialLoading}
            onDraftChange={handleDraftChange}
            onSave={handleSave}
            report={report}
            saving={saving}
          />
        </>
      ) : (
        <Alert variant="error">No tienes permisos para ver los saldos diarios.</Alert>
      )}
    </section>
  );
}
