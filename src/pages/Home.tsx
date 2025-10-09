import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { fetchParticipantLeaderboard } from "../features/participants/api";
import type { ParticipantSummaryRow } from "../features/participants/types";
import type { DbMovement } from "../features/transactions/types";
import { fetchStats, fetchRecentMovements, type StatsResponse } from "../features/dashboard/api";
import MetricCard from "../features/dashboard/components/MetricCard";
import DashboardChart from "../features/dashboard/components/DashboardChart";
import QuickActions from "../features/dashboard/components/QuickActions";
import TopParticipantsWidget from "../features/dashboard/components/TopParticipantsWidget";
import RecentMovementsWidget from "../features/dashboard/components/RecentMovementsWidget";
import ShortcutCard from "../features/dashboard/components/ShortcutCard";
import Alert from "../components/Alert";

const RANGE_DAYS = 30;

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [topParticipants, setTopParticipants] = useState<ParticipantSummaryRow[]>([]);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [recentMovements, setRecentMovements] = useState<DbMovement[]>([]);

  const from = useMemo(() => dayjs().subtract(RANGE_DAYS, "day").format("YYYY-MM-DD"), []);
  const to = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    await Promise.all([loadStats(), loadParticipants(), loadMovements()]);
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const payload = await fetchStats(from, to);
      setStats(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar el resumen";
      setStatsError(message);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadParticipants() {
    setParticipantsError(null);
    try {
      const response = await fetchParticipantLeaderboard({ from, to, limit: 5, mode: "outgoing" });
      setTopParticipants(response.participants);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el ranking de retiros";
      setParticipantsError(message);
      setTopParticipants([]);
    }
  }

  async function loadMovements() {
    try {
      const data = await fetchRecentMovements();
      setRecentMovements(data);
    } catch (err) {
      setRecentMovements([]);
    }
  }

  const totals = useMemo(() => {
    if (!stats) return { in: 0, out: 0, net: 0 };
    const inTotal = stats.totals?.IN ?? 0;
    const outTotal = stats.totals?.OUT ?? 0;
    return {
      in: inTotal,
      out: outTotal,
      net: inTotal - outTotal,
    };
  }, [stats]);

  return (
    <section className="space-y-6">
      <header className="glass-card glass-underlay-gradient space-y-2 p-6">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Panel financiero</h1>
        <p className="text-sm text-slate-600/90">
          Resumen rápido de los últimos {RANGE_DAYS} días con accesos directos a tus vistas principales.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Ingresos" value={totals.in} accent="emerald" loading={statsLoading} />
        <MetricCard title="Egresos" value={totals.out} accent="rose" loading={statsLoading} />
        <MetricCard
          title="Neto"
          value={totals.net}
          accent={totals.net >= 0 ? "emerald" : "rose"}
          loading={statsLoading}
        />
      </section>

      {statsError && <Alert variant="error">{statsError}</Alert>}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6 min-w-0">
          <DashboardChart data={stats?.monthly ?? []} loading={statsLoading} />
          <QuickActions />
        </div>
        <aside className="space-y-6 min-w-0">
          <TopParticipantsWidget data={topParticipants} loading={statsLoading} error={participantsError} />
          <RecentMovementsWidget rows={recentMovements} />
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <ShortcutCard
          title="Subir movimientos"
          description="Carga los nuevos CSV de Mercado Pago y sincronízalos con la base de datos."
          to="/upload"
          accent="secondary"
        />
        <ShortcutCard
          title="Ver movimientos"
          description="Filtra y audita los movimientos guardados con el saldo calculado."
          to="/transactions/movements"
          accent="primary"
        />
        <ShortcutCard
          title="Panel de estadísticas"
          description="Explora tendencias, proporciones y retiros destacados con mayor detalle."
          to="/stats"
          accent="primary"
        />
      </section>
    </section>
  );
}
