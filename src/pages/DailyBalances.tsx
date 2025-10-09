import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import { DailyBalancesPanel } from "../features/balances/components/DailyBalancesPanel";
import { BalanceSummary } from "../features/balances/components/BalanceSummary";
import type { BalancesApiResponse, BalanceDraft } from "../features/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "../features/balances/utils";
import { useQuickDateRange } from "../features/balances/hooks/useQuickDateRange";
import { useDailyBalanceManagement } from "../features/balances/hooks/useDailyBalanceManagement";
import { fetchBalances } from "../features/balances/api";
import Alert from "../components/Alert";
import Input from "../components/Input";
import Button from "../components/Button";

export default function DailyBalances() {
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  // canEdit flag removed (unused)

  const [from, setFrom] = useState(dayjs().subtract(10, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [report, setReport] = useState<BalancesApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  const loadBalances = useCallback(async (fromValue: string, toValue: string) => {
    setLoading(true);
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      logger.info("[balances] fetch:start", { from: fromValue, to: toValue });
      const payload = await fetchBalances(fromValue, toValue);
      setReport(payload);
      const drafts: Record<string, BalanceDraft> = {};
      for (const day of payload.days) {
        drafts[day.date] = {
          value: day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "",
          note: day.note ?? "",
        };
      }
      setDrafts(drafts);
      logger.info("[balances] fetch:success", { days: payload.days.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los saldos diarios";
      setSummaryError(message);
      setReport(null);
      setDrafts({});
      logger.error("[balances] fetch:error", message);
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, []);

  const { drafts, saving, error, handleDraftChange, handleSave, setDrafts } = useDailyBalanceManagement({
    from,
    to,
    loadBalances,
  });

  useEffect(() => {
    loadBalances(from, to);
  }, [from, to, loadBalances]);

  const derivedInitial = useMemo(() => (report ? deriveInitialBalance(report) : null), [report]);

  return (
    <section className="space-y-6">
      {!hasRole("GOD", "ADMIN", "ANALYST", "VIEWER") ? (
        <Alert variant="error">No tienes permisos para ver los saldos diarios.</Alert>
      ) : (
        <>
          <div className="glass-card glass-underlay-gradient flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Saldos diarios</h1>
              <p className="max-w-2xl text-sm text-slate-600/90">
                Registra el saldo de la cuenta a las 23:59 de cada día para conciliar los movimientos almacenados en{" "}
                <code>mp_transactions</code>. Para consultas, escribe a<strong> {settings.supportEmail}</strong>.
              </p>
              {derivedInitial != null && (
                <p className="text-xs text-slate-500/80">
                  Saldo anterior calculado: <strong>{formatBalanceInput(derivedInitial)}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Fecha desde"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="w-fit"
              />
              <Input
                label="Fecha hasta"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-fit"
              />
              <Input
                label="Mes rápido"
                type="select"
                value={quickRange}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "custom") return;
                  const match = quickMonths.find((month) => month.value === value);
                  if (!match) return;
                  setFrom(match.from);
                  setTo(match.to);
                  loadBalances(match.from, match.to);
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
              <Button onClick={() => loadBalances(from, to)} disabled={loading} size="sm">
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <BalanceSummary report={report} loading={summaryLoading} error={summaryError} />

          <DailyBalancesPanel
            report={report}
            drafts={drafts}
            onDraftChange={handleDraftChange}
            onSave={handleSave}
            saving={saving}
            loading={loading}
            error={error}
          />
        </>
      )}
    </section>
  );
}
