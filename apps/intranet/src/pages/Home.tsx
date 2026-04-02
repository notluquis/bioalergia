import { Skeleton, Surface } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, ArrowUpRight, CalendarDays, Users, Wallet } from "lucide-react";
import { Suspense, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { DashboardParticipantsSection } from "@/features/dashboard/components/DashboardParticipantsSection";
import { DashboardPersonalLiabilities } from "@/features/dashboard/components/DashboardPersonalLiabilities";
import { DashboardTransactionsSection } from "@/features/dashboard/components/DashboardTransactionsSection";
import { daysAgo, today } from "@/lib/dates";
import { useAppBadge } from "../hooks/use-app-badge";
import { useWakeLock } from "../hooks/use-wake-lock";

const RANGE_DAYS = 30;
export function Home() {
  useWakeLock();
  const { clearBadge } = useAppBadge();
  const { can } = useAuth();

  useEffect(() => {
    void clearBadge();
  }, [clearBadge]);

  // Permissions
  const canReadTransactions = can("read", "Transaction");
  const canReadPersons = can("read", "Person");
  const canReadDashboard = can("read", "Dashboard");

  const from = daysAgo(RANGE_DAYS);
  const to = today();

  const statsParams = { from, to };
  const leaderboardParams = { from, limit: 5, mode: "outgoing" as const, to };

  if (!canReadDashboard) {
    return (
      <div className="p-8 text-center text-default-500">
        No tienes permisos para ver el panel principal.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {canReadTransactions && (
        <>
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardTransactionsSection statsParams={statsParams} />
          </Suspense>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
            <div className="space-y-4">
              <DashboardPersonalLiabilities />
              <QuickLinksSection can={can} />
            </div>
            <aside className="space-y-4">
              {canReadPersons && (
                <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
                  <DashboardParticipantsSection params={leaderboardParams} />
                </Suspense>
              )}
            </aside>
          </div>
        </>
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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-xl bg-default-50" />
        <div className="h-24 rounded-xl bg-default-50" />
        <div className="h-24 rounded-xl bg-default-50" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="h-64 rounded-xl bg-default-50" />
        <div className="h-64 rounded-xl bg-default-50" />
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  {
    action: "read", // Minimum requirement
    bg: "bg-emerald-500/10",
    color: "text-emerald-500",
    description: "Actualiza saldos diarios y conciliaciones.",
    icon: Wallet,
    subject: "DailyBalance",
    title: "Registrar saldo",
    to: "/finanzas/production-balances" as const,
  },
  {
    action: "read",
    bg: "bg-blue-500/10",
    color: "text-blue-500",
    description: "Audita los movimientos y flujos de caja.",
    icon: ArrowRightLeft,
    subject: "Transaction",
    title: "Ver movimientos",
    to: "/finanzas/statistics" as const,
  },
  {
    action: "read",
    bg: "bg-violet-500/10",
    color: "text-violet-500",
    description: "Gestiona contrapartes y sus historiales.",
    icon: Users,
    subject: "Counterpart",
    title: "Contrapartes",
    to: "/finanzas/counterparts" as const,
  },
  {
    action: "read",
    bg: "bg-amber-500/10",
    color: "text-amber-500",
    description: "Administra servicios recurrentes y agenda.",
    icon: CalendarDays,
    subject: "Service",
    title: "Servicios",
    to: "/services" as const,
  },
] as const;

function QuickLinksSection({ can }: { can: (action: string, subject: string) => boolean }) {
  const links = QUICK_LINKS.filter((link) => can(link.action, link.subject));

  if (links.length === 0) {
    return null;
  }

  return (
    <Surface className="space-y-4 rounded-3xl p-5 shadow-inner" variant="secondary">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm">Accesos rápidos</h3>
        <span className="rounded-full border border-default-200/80 bg-background px-3 py-1 text-[11px] text-default-500 uppercase tracking-wide">
          {links.length} accesos
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-default-200/70 bg-background/70 p-4 transition hover:border-primary/35 hover:bg-background"
            key={link.to}
            to={link.to}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${link.bg} ${link.color}`}
            >
              <link.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground text-sm">{link.title}</p>
              <p className="line-clamp-2 text-default-500 text-xs">{link.description}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-default-400 transition group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </Surface>
  );
}
