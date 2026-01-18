import { currencyFormatter } from "@/lib/format";

import type { MonthlyExpenseStatsRow } from "../types";

interface MonthlyExpenseStatsProps {
  loading: boolean;
  stats: MonthlyExpenseStatsRow[];
}

export default function MonthlyExpenseStats({ loading, stats }: Readonly<MonthlyExpenseStatsProps>) {
  if (loading) {
    return <p className="text-base-content/50 text-xs">Calculando estadísticas…</p>;
  }

  if (stats.length === 0) {
    return <p className="text-base-content/50 text-xs">No hay datos disponibles para el período seleccionado.</p>;
  }

  return (
    <div className="muted-scrollbar text-base-content/60 max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
      {stats.map((row) => (
        <article className="border-base-300 bg-base-200 rounded-xl border p-3 shadow-sm" key={row.period}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base-content text-sm font-semibold">{row.period}</p>
              <p className="text-base-content/50 text-xs">{row.expenseCount} gastos registrados</p>
            </div>
            <div className="text-right">
              <p className="text-base-content text-sm font-semibold">
                Esperado {currencyFormatter.format(row.totalExpected)}
              </p>
              <p className="text-base-content/50 text-xs">Aplicado {currencyFormatter.format(row.totalApplied)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
