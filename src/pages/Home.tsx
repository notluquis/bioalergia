import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Wallet, ArrowRightLeft, Users, CalendarDays, ArrowUpRight } from "lucide-react";
import { daysAgo, today } from "@/lib/dates";
import { useDashboardStats, useRecentMovements } from "@/features/dashboard/hooks";
import { useParticipantLeaderboardQuery } from "@/features/participants/hooks";
import MetricCard from "@/features/dashboard/components/MetricCard";
import DashboardChart from "@/features/dashboard/components/DashboardChart";
import TopParticipantsWidget from "@/features/dashboard/components/TopParticipantsWidget";
import RecentMovementsWidget from "@/features/dashboard/components/RecentMovementsWidget";
import Alert from "@/components/ui/Alert";
import { CARD_COMPACT, TITLE_MD } from "@/lib/styles";
import { useWakeLock } from "../hooks/useWakeLock";
import { useAppBadge } from "../hooks/useAppBadge";
import { useAuth } from "@/context/AuthContext";

const RANGE_DAYS = 30;

export default function Home() {
  useWakeLock();
  const { clearBadge } = useAppBadge();
  const { can } = useAuth();

  useEffect(() => {
    clearBadge();
  }, [clearBadge]);

  // Permissions
  const canReadTransactions = can("read", "Transaction");
  const canReadPersons = can("read", "Person");
  const canReadDashboard = can("read", "Dashboard"); // Top level check?

  const from = useMemo(() => daysAgo(RANGE_DAYS), []);
  const to = useMemo(() => today(), []);

  const statsParams = useMemo(() => ({ from, to }), [from, to]);
  // Pass enabled to hooks if they support it to avoid 403s
  const statsQuery = useDashboardStats(statsParams, { enabled: canReadTransactions });

  const leaderboardParams = useMemo(() => ({ from, to, limit: 5, mode: "outgoing" as const }), [from, to]);
  const participantsQuery = useParticipantLeaderboardQuery(leaderboardParams, {
    enabled: Boolean(from && to) && canReadPersons,
  });

  const recentMovementsQuery = useRecentMovements({ enabled: canReadTransactions });

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

  if (!canReadDashboard) {
    return <div className="text-base-content/60 p-8 text-center">No tienes permisos para ver el panel principal.</div>;
  }

  return (
    <section className="space-y-4">
      <header className={CARD_COMPACT}>
        <div className="card-body">
          <h1 className={TITLE_MD}>Panel</h1>
          <p className="text-base-content/70 text-sm">Últimos {RANGE_DAYS} días</p>
        </div>
      </header>

      {canReadTransactions && (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <MetricCard title="Ingresos" value={totals.in} accent="emerald" loading={statsLoading} />
          <MetricCard title="Egresos" value={totals.out} accent="rose" loading={statsLoading} />
          <MetricCard
            title="Neto"
            value={totals.net}
            accent={totals.net >= 0 ? "emerald" : "rose"}
            loading={statsLoading}
          />
        </section>
      )}

      {statsError && canReadTransactions && <Alert variant="error">{statsError}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {canReadTransactions && <DashboardChart data={stats?.monthly ?? []} loading={statsLoading} />}
          <QuickLinksSection can={can} />
        </div>
        <aside className="space-y-4">
          {canReadPersons && (
            <TopParticipantsWidget data={topParticipants} loading={participantsLoading} error={participantsError} />
          )}
          {canReadTransactions && <RecentMovementsWidget rows={recentMovements} />}
        </aside>
      </div>
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
    subject: "DailyBalance",
    action: "read", // Minimum requirement
  },
  {
    title: "Ver movimientos",
    description: "Audita los movimientos y flujos de caja.",
    to: "/transactions/movements",
    icon: ArrowRightLeft,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    subject: "Transaction",
    action: "read",
  },
  {
    title: "Participantes",
    description: "Gestiona contrapartes y sus historiales.",
    to: "/transactions/participants",
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    subject: "Person",
    action: "read",
  },
  {
    title: "Servicios",
    description: "Administra servicios recurrentes y agenda.",
    to: "/services",
    icon: CalendarDays,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    subject: "Service",
    action: "read",
  },
] as const;

function QuickLinksSection({ can }: { can: (action: string, subject: string) => boolean }) {
  const links = QUICK_LINKS.filter((link) => can(link.action, link.subject));

  if (links.length === 0) return null;

  return (
    <div className="card card-compact bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="text-base-content mb-2 text-sm font-semibold">Accesos rápidos</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group border-base-200 bg-base-200/50 hover:bg-base-200 flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${link.bg} ${link.color}`}>
                <link.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base-content truncate text-sm font-medium">{link.title}</p>
                <p className="text-base-content/70 truncate text-xs">{link.description}</p>
              </div>
              <ArrowUpRight className="text-base-content/60 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
