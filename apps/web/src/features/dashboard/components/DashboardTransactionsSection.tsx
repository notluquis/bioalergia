import { useSuspenseQuery } from "@tanstack/react-query";

import { dashboardKeys } from "../queries";
import DashboardChart from "./DashboardChart";
import MetricCard from "./MetricCard";
import RecentMovementsWidget from "./RecentMovementsWidget";

interface Props {
  statsParams: { from: string; to: string };
}

export default function DashboardTransactionsSection({ statsParams }: Props) {
  const { data: stats } = useSuspenseQuery(dashboardKeys.stats(statsParams));
  const { data: recentMovements } = useSuspenseQuery(dashboardKeys.recentMovements());

  const totals = stats.totals
    ? {
        in: stats.totals.IN ?? 0,
        net: (stats.totals.IN ?? 0) - (stats.totals.OUT ?? 0),
        out: stats.totals.OUT ?? 0,
      }
    : { in: 0, net: 0, out: 0 };

  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <MetricCard accent="emerald" loading={false} title="Ingresos" value={totals.in} />
        <MetricCard accent="rose" loading={false} title="Egresos" value={totals.out} />
        <MetricCard accent={totals.net >= 0 ? "emerald" : "rose"} loading={false} title="Neto" value={totals.net} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <DashboardChart data={stats.monthly ?? []} loading={false} />
          {/* QuickLinks injected from parent? No, Home renders it. */}
        </div>
        <aside className="space-y-4">
          <RecentMovementsWidget rows={recentMovements} />
        </aside>
      </div>
    </>
  );
}
