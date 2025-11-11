import { useMemo } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { useDashboardStats, useRecentMovements } from "../features/dashboard/hooks";
import { useParticipantLeaderboardQuery } from "../features/participants/hooks";
import MetricCard from "../features/dashboard/components/MetricCard";
import DashboardChart from "../features/dashboard/components/DashboardChart";
import TopParticipantsWidget from "../features/dashboard/components/TopParticipantsWidget";
import RecentMovementsWidget from "../features/dashboard/components/RecentMovementsWidget";
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
    <section className="flex flex-col gap-6">
      <header className="surface-elevated space-y-2 rounded-3xl p-6 shadow-lg">
        <h1 className="typ-title text-base-content">Panel financiero</h1>
        <p className="typ-body text-base-content/70">
          Resumen rápido de los últimos {RANGE_DAYS} días con accesos directos a tus vistas principales.
        </p>
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
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

      <section className="grid auto-rows-min gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6 min-w-0">
          <DashboardChart data={stats?.monthly ?? []} loading={statsLoading} />
          <QuickLinksSection />
        </div>
        <aside className="space-y-6 min-w-0">
          <TopParticipantsWidget data={topParticipants} loading={participantsLoading} error={participantsError} />
          <RecentMovementsWidget rows={recentMovements} />
        </aside>
      </section>
    </section>
  );
}

const QUICK_LINKS = [
  {
    title: "Subir movimientos",
    description: "Carga los nuevos CSV de Mercado Pago y sincronízalos con la base.",
    to: "/upload",
  },
  {
    title: "Registrar saldo",
    description: "Actualiza saldos diarios con conciliaciones manuales.",
    to: "/transactions/balances",
  },
  {
    title: "Ver movimientos",
    description: "Filtra y audita los movimientos guardados con el saldo calculado.",
    to: "/transactions/movements",
  },
  {
    title: "Panel de estadísticas",
    description: "Explora tendencias, proporciones y retiros destacados.",
    to: "/stats",
  },
  {
    title: "Participantes",
    description: "Consulta retiros y aportes por contraparte.",
    to: "/transactions/participants",
  },
  {
    title: "Servicios",
    description: "Gestiona servicios recurrentes y su agenda.",
    to: "/services",
  },
];

function QuickLinksSection() {
  return (
    <article className="surface-elevated space-y-4 rounded-3xl p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-base-content">Accesos rápidos</p>
          <p className="text-xs text-base-content/60">Accede a tus vistas más usadas en un solo lugar.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-2xl border border-base-300 bg-base-100/80 p-4 text-sm text-base-content shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <p className="text-sm font-semibold text-base-content">{link.title}</p>
            <p className="mt-1 text-xs text-base-content/70">{link.description}</p>
            <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Abrir
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
