import type { MonthlyExpenseStatsRow } from "../types";

interface MonthlyExpenseStatsProps {
  stats: MonthlyExpenseStatsRow[];
  loading: boolean;
}

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function MonthlyExpenseStats({ stats, loading }: MonthlyExpenseStatsProps) {
  if (loading) {
    return <p className="text-xs text-base-content/50">Calculando estadísticas…</p>;
  }

  if (!stats.length) {
    return <p className="text-xs text-base-content/50">No hay datos disponibles para el período seleccionado.</p>;
  }

  return (
    <div className="muted-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1 text-xs text-base-content/60">
      {stats.map((row) => (
        <article key={row.period} className="rounded-xl border border-base-300 bg-base-200 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-base-content">{row.period}</p>
              <p className="text-xs text-base-content/50">{row.expenseCount} gastos registrados</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-base-content">
                Esperado {currencyFormatter.format(row.totalExpected)}
              </p>
              <p className="text-xs text-base-content/50">Aplicado {currencyFormatter.format(row.totalApplied)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
