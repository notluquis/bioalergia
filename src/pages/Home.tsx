import { useMemo } from "react";
import dayjs from "dayjs";
import { useDashboardStats, useRecentMovements } from "../features/dashboard/hooks";
import { useParticipantLeaderboardQuery } from "../features/participants/hooks";
import MetricCard from "../features/dashboard/components/MetricCard";
import DashboardChart from "../features/dashboard/components/DashboardChart";
import QuickActions from "../features/dashboard/components/QuickActions";
import TopParticipantsWidget from "../features/dashboard/components/TopParticipantsWidget";
import RecentMovementsWidget from "../features/dashboard/components/RecentMovementsWidget";
import ShortcutCard from "../features/dashboard/components/ShortcutCard";
import Alert from "../components/Alert";

const RANGE_DAYS = 30;

export default function Home() {
  const from = useMemo(() => dayjs().subtract(RANGE_DAYS, "day").format("YYYY-MM-DD"), []);
  const to = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const statsParams = useMemo(() => ({ from, to }), [from, to]);
  const statsQuery = useDashboardStats(statsParams);

  const leaderboardParams = useMemo(() => ({ from, to, limit: 5, mode: "outgoing" as const }), [from, to]);
  const participantsQuery = useParticipantLeaderboardQuery(leaderboardParams, {
    enabled: Boolean(from && to),
  });

  const recentMovementsQuery = useRecentMovements();

  const stats = statsQuery.data ?? null;
  const statsLoading = statsQuery.isPending || statsQuery.isFetching;
  const statsError = statsQuery.error instanceof Error ? statsQuery.error.message : null;

  const topParticipants = participantsQuery.data ?? [];
  const participantsLoading = participantsQuery.isPending || participantsQuery.isFetching;
  const participantsError = participantsQuery.error instanceof Error ? participantsQuery.error.message : null;

  const recentMovements = recentMovementsQuery.data ?? [];

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
      <header className="card bg-base-100 shadow-lg space-y-2 p-6">
        <h1 className="text-2xl font-bold text-primary drop-shadow-sm">Panel financiero</h1>
        <p className="text-sm text-base-content/70">
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
          <TopParticipantsWidget data={topParticipants} loading={participantsLoading} error={participantsError} />
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
