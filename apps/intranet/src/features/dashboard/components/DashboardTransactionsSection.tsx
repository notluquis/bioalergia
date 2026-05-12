import { useSuspenseQuery } from "@tanstack/react-query";

import { dashboardKeys } from "../queries";
import { DashboardChart } from "./DashboardChart";
import { MetricCard } from "./MetricCard";
import { RecentMovementsWidget } from "./RecentMovementsWidget";

interface Props {
  statsParams: { from: string; to: string };
}
export function DashboardTransactionsSection({ statsParams }: Props) {
  const { data: stats } = useSuspenseQuery(dashboardKeys.stats(statsParams));
  const { data: recentMovements } = useSuspenseQuery(dashboardKeys.recentMovements());

  const rawTotals = stats.totals ?? {};
  const totalIn = rawTotals.in ?? rawTotals.IN ?? 0;
  const totalOut = rawTotals.out ?? rawTotals.OUT ?? 0;
  const totalNet = rawTotals.net ?? totalIn - totalOut;
  const totals = { in: totalIn, net: totalNet, out: totalOut };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <MetricCard accent="emerald" loading={false} title="Ingresos" value={totals.in} />
        <MetricCard accent="rose" loading={false} title="Egresos" value={totals.out} />
        <MetricCard
          accent={totals.net >= 0 ? "emerald" : "rose"}
          loading={false}
          title="Neto"
          value={totals.net}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
        <div className="space-y-5">
          <DashboardChart data={stats.monthly ?? []} loading={false} />
        </div>
        {/* <section> instead of <aside> — this widget lives inside <main>
            and a complementary landmark must be top-level (WCAG 1.3.1). */}
        <section aria-label="Movimientos recientes" className="space-y-5">
          <RecentMovementsWidget rows={recentMovements} />
        </section>
      </div>
    </div>
  );
}
