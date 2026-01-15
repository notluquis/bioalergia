import { useSuspenseQuery } from "@tanstack/react-query";

import { dashboardKeys } from "../queries";
import DashboardChart from "./DashboardChart";
import MetricCard from "./MetricCard";
import RecentMovementsWidget from "./RecentMovementsWidget";

type Props = {
  statsParams: { from: string; to: string };
};

export default function DashboardTransactionsSection({ statsParams }: Props) {
  const { data: stats } = useSuspenseQuery(dashboardKeys.stats(statsParams));
  const { data: recentMovements } = useSuspenseQuery(dashboardKeys.recentMovements());

  const totals = stats.totals
    ? {
        in: stats.totals.IN ?? 0,
        out: stats.totals.OUT ?? 0,
        net: (stats.totals.IN ?? 0) - (stats.totals.OUT ?? 0),
      }
    : { in: 0, out: 0, net: 0 };

  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <MetricCard title="Ingresos" value={totals.in} accent="emerald" loading={false} />
        <MetricCard title="Egresos" value={totals.out} accent="rose" loading={false} />
        <MetricCard title="Neto" value={totals.net} accent={totals.net >= 0 ? "emerald" : "rose"} loading={false} />
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
