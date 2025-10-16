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
    return <p className="text-xs text-slate-400">Calculando estadísticas…</p>;
  }

  if (!stats.length) {
    return <p className="text-xs text-slate-400">No hay datos disponibles para el período seleccionado.</p>;
  }

  return (
    <div className="muted-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1 text-xs text-slate-500">
      {stats.map((row) => (
        <article key={row.period} className="rounded-xl border border-white/45 bg-white/70 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">{row.period}</p>
              <p className="text-[11px] text-slate-400">{row.expenseCount} gastos registrados</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">Esperado {currencyFormatter.format(row.totalExpected)}</p>
              <p className="text-[11px] text-slate-400">Aplicado {currencyFormatter.format(row.totalApplied)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
