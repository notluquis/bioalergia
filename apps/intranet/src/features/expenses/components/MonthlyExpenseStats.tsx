import { currencyFormatter } from "@/lib/format";

import type { MonthlyExpenseStatsRow } from "../types";

interface MonthlyExpenseStatsProps {
  loading: boolean;
  stats: MonthlyExpenseStatsRow[];
}
export function MonthlyExpenseStats({ loading, stats }: Readonly<MonthlyExpenseStatsProps>) {
  if (loading) {
    return <p className="text-default-400 text-xs">Calculando estadísticas…</p>;
  }

  if (stats.length === 0) {
    return (
      <p className="text-default-400 text-xs">
        No hay datos disponibles para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="muted-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1 text-default-500 text-xs">
      {stats.map((row) => (
        <article
          className="rounded-xl border border-default-200 bg-default-50 p-3 shadow-sm"
          key={row.period}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground text-sm">{row.period}</p>
              <p className="text-default-400 text-xs">{row.expenseCount} gastos registrados</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground text-sm">
                Esperado {currencyFormatter.format(row.totalExpected)}
              </p>
              <p className="text-default-400 text-xs">
                Aplicado {currencyFormatter.format(row.totalApplied)}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
