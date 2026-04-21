import type { CalendarEventDetail } from "@/features/calendar/types";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricCard } from "./MetricCard";

interface DailyStatsCardsProps {
  amountExpected: number;
  amountPaid: number;
  className?: string;
  events: CalendarEventDetail[];
  eventsCount: number;
}

export function DailyStatsCards({
  amountExpected,
  amountPaid,
  className,
  events,
  eventsCount,
}: Readonly<DailyStatsCardsProps>) {
  const confirmedCount = events.filter((event) => event.attended != null).length;
  const inductionCount = events.filter((event) => event.treatmentStage === "Inducción").length;
  const maintenanceCount = events.filter((event) => event.treatmentStage === "Mantención").length;
  const withoutStageCount = events.filter(
    (event) => !event.treatmentStage || event.treatmentStage.trim() === ""
  ).length;
  const totalDosageMl = events.reduce((sum, event) => sum + (event.dosageValue ?? 0), 0);
  const collectionRate = amountExpected > 0 ? (amountPaid / amountExpected) * 100 : 0;

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3 xl:grid-cols-5", className)}>
      <MetricCard title="Eventos" tone="primary" value={numberFormatter.format(eventsCount)} />

      <MetricCard
        title="Confirmados"
        tone="success"
        value={numberFormatter.format(confirmedCount)}
      />

      <MetricCard
        subtitle={`${currencyFormatter.format(amountPaid)} de ${currencyFormatter.format(amountExpected)}`}
        suffix="%"
        title="Cobranza Día"
        tone={collectionRate >= 90 ? "success" : collectionRate >= 70 ? "warning" : "error"}
        value={collectionRate.toFixed(1)}
      />

      <MetricCard
        subtitle={`Inducción ${inductionCount} · Mantención ${maintenanceCount} · Sin etapa ${withoutStageCount}`}
        title="Mix Etapa"
        tone="primary"
        value={`${inductionCount}/${maintenanceCount}`}
      />

      <MetricCard
        subtitle={`${eventsCount > 0 ? (totalDosageMl / eventsCount).toFixed(2) : "0.00"} ml promedio por evento`}
        title="Dosis Total Día"
        value={`${totalDosageMl.toFixed(2)} ml`}
      />

      <MetricCard
        title="Esperado"
        tone="warning"
        value={currencyFormatter.format(amountExpected)}
      />

      <MetricCard title="Pagado" tone="success" value={currencyFormatter.format(amountPaid)} />
    </div>
  );
}
