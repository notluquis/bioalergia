import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type { FinancialSummary } from "../types";

interface FinancialSummaryCardsProps {
  summary: FinancialSummary | null;
  isLoading: boolean;
}

export function FinancialSummaryCards({
  summary,
  isLoading,
}: Readonly<FinancialSummaryCardsProps>) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-background h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard
        icon={DollarSign}
        title="Ingresos Totales"
        value={`$${summary.totalIncome.toLocaleString("es-CL")}`}
        tone="success"
        subtitle="Desde Calendario"
      />
      <StatCard
        icon={TrendingDown}
        title="Gastos Totales"
        value={`$${summary.totalExpense.toLocaleString("es-CL")}`}
        tone="error"
        subtitle="Proyectado"
      />
      <StatCard
        icon={TrendingUp}
        title="Utilidad Neta"
        value={`$${summary.netIncome.toLocaleString("es-CL")}`}
        tone="primary"
        subtitle="Ingresos - Gastos"
      />
    </div>
  );
}
