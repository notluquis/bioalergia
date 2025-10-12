import { useMemo } from "react";
import { useAuth } from "../context/auth-context";
import { BalanceSummary } from "../features/balances/components/BalanceSummary";
import { useStatsData } from "../features/stats/hooks/useStatsData";
import StatCard from "../features/stats/components/StatCard";
import MonthlyFlowChart from "../features/stats/components/MonthlyFlowChart";
import MovementTypeList from "../features/stats/components/MovementTypeList";
import TopParticipantsSection from "../features/stats/components/TopParticipantsSection";
import Alert from "../components/Alert";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Stats() {
  const { hasRole } = useAuth();
  const {
    from,
    setFrom,
    to,
    setTo,
    quickRange,
    quickMonths,
    loading,
    error,
    data,
    balancesReport,
    balancesLoading,
    balancesError,
    topParticipants,
    participantsLoading,
    participantsError,
    fetchStats,
    fetchStatsWithRange,
  } = useStatsData();

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const totals = useMemo(() => {
    if (!data) return { in: 0, out: 0, net: 0 };
    const inTotal = data.totals?.IN ?? 0;
    const outTotal = data.totals?.OUT ?? 0;
    return {
      in: inTotal,
      out: outTotal,
      net: inTotal - outTotal,
    };
  }, [data]);

  if (!canView) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Estadísticas</h1>
        <Alert variant="error">No tienes permisos para ver las estadísticas.</Alert>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Estadísticas financieras</h1>
        <p className="text-sm text-slate-600">
          Resumen contable por mes, tipo de movimiento y direcciones. Ajusta el rango de fechas para analizar
          tendencias.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          fetchStats();
        }}
        className="grid gap-4 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 text-xs text-slate-600 shadow-sm sm:grid-cols-5"
      >
        <Input label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input label="Hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Input
          label="Intervalo rápido"
          type="select"
          value={quickRange}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") return;
            const match = quickMonths.find((month) => month.value === value);
            if (!match) return;
            setFrom(match.from);
            setTo(match.to);
            fetchStatsWithRange(match.from, match.to);
          }}
        >
          <option value="custom">Personalizado</option>
          {quickMonths.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </Input>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Calculando..." : "Actualizar"}
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Ingresos" value={totals.in} accent="emerald" />
            <StatCard title="Egresos" value={totals.out} accent="rose" />
            <StatCard title="Resultado neto" value={totals.net} accent={totals.net >= 0 ? "emerald" : "rose"} />
          </section>

          <MonthlyFlowChart data={data.monthly} />

          <BalanceSummary report={balancesReport} loading={balancesLoading} error={balancesError} />

          <section className="space-y-3 glass-card glass-underlay-gradient p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Por tipo de movimiento</h2>
            <MovementTypeList data={data.byType} />
          </section>

          <TopParticipantsSection data={topParticipants} loading={participantsLoading} error={participantsError} />
        </div>
      )}

      {!loading && !error && data && !data.monthly.length && (
        <Alert variant="warning">No se encontraron movimientos en el rango seleccionado.</Alert>
      )}
    </section>
  );
}
