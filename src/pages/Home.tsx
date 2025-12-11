import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { Wallet, ArrowRightLeft, Users, CalendarDays, ArrowUpRight } from "lucide-react";
import { useDashboardStats, useRecentMovements } from "@/features/dashboard/hooks";
import { useParticipantLeaderboardQuery } from "@/features/participants/hooks";
import MetricCard from "@/features/dashboard/components/MetricCard";
import DashboardChart from "@/features/dashboard/components/DashboardChart";
import TopParticipantsWidget from "@/features/dashboard/components/TopParticipantsWidget";
import RecentMovementsWidget from "@/features/dashboard/components/RecentMovementsWidget";
import Alert from "@/components/ui/Alert";
import { useWakeLock } from "../hooks/useWakeLock";
import { useAppBadge } from "../hooks/useAppBadge";

const RANGE_DAYS = 30;

export default function Home() {
  useWakeLock(); // Keep screen active on dashboard
  const { clearBadge } = useAppBadge();

  // Clear notification badge when user visits dashboard
  useEffect(() => {
    clearBadge();
  }, [clearBadge]);

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
    <section className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="from-base-100 via-base-100 to-primary/5 ring-base-content/5 relative overflow-hidden rounded-3xl bg-linear-to-br p-8 shadow-lg ring-1">
        <div className="relative z-10 space-y-2">
          <h1 className="text-base-content text-3xl font-bold tracking-tight break-all">Panel financiero</h1>
          <p className="text-base-content/60 max-w-2xl text-base font-medium">
            Resumen de actividad de los últimos {RANGE_DAYS} días y accesos directos a tus operaciones frecuentes.
          </p>
        </div>
        <div className="bg-primary/5 absolute -top-10 -right-10 h-64 w-64 rounded-full blur-3xl" />
        <div className="bg-secondary/5 absolute right-20 -bottom-10 h-40 w-40 rounded-full blur-2xl" />
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
        <div className="min-w-0 space-y-6">
          <DashboardChart data={stats?.monthly ?? []} loading={statsLoading} />
          <QuickLinksSection />
        </div>
        <aside className="min-w-0 space-y-6">
          <TopParticipantsWidget data={topParticipants} loading={participantsLoading} error={participantsError} />
          <RecentMovementsWidget rows={recentMovements} />
        </aside>
      </section>
    </section>
  );
}

const QUICK_LINKS = [
  {
    title: "Registrar saldo",
    description: "Actualiza saldos diarios y conciliaciones.",
    to: "/transactions/balances",
    icon: Wallet,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Ver movimientos",
    description: "Audita los movimientos y flujos de caja.",
    to: "/transactions/movements",
    icon: ArrowRightLeft,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Participantes",
    description: "Gestiona contrapartes y sus historiales.",
    to: "/transactions/participants",
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "Servicios",
    description: "Administra servicios recurrentes y agenda.",
    to: "/services",
    icon: CalendarDays,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

function QuickLinksSection() {
  return (
    <article className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base-content text-lg font-semibold">Accesos rápidos</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group border-base-200 bg-base-100 hover:border-primary/20 relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${link.bg} ${link.color} transition-transform duration-300 group-hover:scale-110`}
              >
                <link.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base-content group-hover:text-primary font-semibold transition-colors">
                  {link.title}
                </h4>
                <p className="text-base-content/60 mt-1 line-clamp-2 text-sm">{link.description}</p>
              </div>
              <div className="text-base-content/30 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
