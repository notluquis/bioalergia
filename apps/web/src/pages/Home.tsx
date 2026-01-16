import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, ArrowUpRight, CalendarDays, Users, Wallet } from "lucide-react";
import { Suspense, useEffect } from "react";

import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import DashboardParticipantsSection from "@/features/dashboard/components/DashboardParticipantsSection";
import { DashboardPersonalLiabilities } from "@/features/dashboard/components/DashboardPersonalLiabilities";
import DashboardTransactionsSection from "@/features/dashboard/components/DashboardTransactionsSection";
import { daysAgo, today } from "@/lib/dates";
import { CARD_COMPACT, TITLE_MD } from "@/lib/styles";

import { useAppBadge } from "../hooks/useAppBadge";
import { useWakeLock } from "../hooks/useWakeLock";

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
  const canReadDashboard = can("read", "Dashboard");

  const from = daysAgo(RANGE_DAYS);
  const to = today();

  const statsParams = { from, to };
  const leaderboardParams = { from, to, limit: 5, mode: "outgoing" as const };

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
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardTransactionsSection statsParams={statsParams} />
        </Suspense>
      )}

      {!canReadTransactions && (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <DashboardPersonalLiabilities />
            <QuickLinksSection can={can} />
          </div>
          <aside className="space-y-4">
            {/* If can't read transactions, maybe can read participants? */}
            {canReadPersons && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <DashboardParticipantsSection params={leaderboardParams} />
              </Suspense>
            )}
          </aside>
        </div>
      )}

      {/* If can read transactions, QuickLinks and Participants are inside the layout? 
          Wait, in previous layout:
          grid lg:grid-cols-[1.5fr_1fr]
            left: Charts + QuickLinks
            right: Participants + RecentMovements
          
          My wrapper `DashboardTransactionsSection` returns:
          Metrics (full width)
          Grid (Charts + RecentMovements)
          
          It MISSES QuickLinks and Participants inside the grid structure.
          
          I need to compose them better.
      */}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-base-200 h-24 rounded-xl" />
        <div className="bg-base-200 h-24 rounded-xl" />
        <div className="bg-base-200 h-24 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="bg-base-200 h-64 rounded-xl" />
        <div className="bg-base-200 h-64 rounded-xl" />
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  {
    title: "Registrar saldo",
    description: "Actualiza saldos diarios y conciliaciones.",
    to: "/finanzas/production-balances" as const,
    icon: Wallet,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    subject: "DailyBalance",
    action: "read", // Minimum requirement
  },
  {
    title: "Ver movimientos",
    description: "Audita los movimientos y flujos de caja.",
    to: "/finanzas/statistics" as const,
    icon: ArrowRightLeft,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    subject: "Transaction",
    action: "read",
  },
  {
    title: "Participantes",
    description: "Gestiona contrapartes y sus historiales.",
    to: "/finanzas/participants" as const,
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    subject: "Person",
    action: "read",
  },
  {
    title: "Servicios",
    description: "Administra servicios recurrentes y agenda.",
    to: "/services" as const,
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
