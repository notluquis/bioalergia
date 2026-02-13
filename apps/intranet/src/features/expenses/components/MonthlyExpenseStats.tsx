import { Description } from "@heroui/react";
import { currencyFormatter } from "@/lib/format";

import type { MonthlyExpenseStatsRow } from "../types";

interface MonthlyExpenseStatsProps {
  loading: boolean;
  stats: MonthlyExpenseStatsRow[];
}
export function MonthlyExpenseStats({ loading, stats }: Readonly<MonthlyExpenseStatsProps>) {
  if (loading) {
    return <Description className="text-default-400 text-xs">Calculando estadísticas…</Description>;
  }

  if (stats.length === 0) {
    return (
      <Description className="text-default-400 text-xs">
        No hay datos disponibles para el período seleccionado.
      </Description>
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
              <span className="block font-semibold text-foreground text-sm">{row.period}</span>
              <Description className="text-default-400 text-xs">
                {row.expenseCount} gastos registrados
              </Description>
            </div>
            <div className="text-right">
              <span className="block font-semibold text-foreground text-sm">
                Esperado {currencyFormatter.format(row.totalExpected)}
              </span>
              <Description className="text-default-400 text-xs">
                Aplicado {currencyFormatter.format(row.totalApplied)}
              </Description>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
