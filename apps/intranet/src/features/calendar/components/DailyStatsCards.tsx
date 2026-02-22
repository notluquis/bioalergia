import { StatCard } from "@/components/ui/StatCard";
import type { CalendarEventDetail } from "@/features/calendar/types";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const confirmedCount = events.filter((event) => event.attended === true).length;
  const noShowCount = events.filter((event) => event.attended === false).length;
  const inductionCount = events.filter((event) => event.treatmentStage === "Inducción").length;
  const maintenanceCount = events.filter((event) => event.treatmentStage === "Mantención").length;
  const withoutStageCount = events.filter(
    (event) => !event.treatmentStage || event.treatmentStage.trim() === "",
  ).length;
  const totalDosageMl = events.reduce((sum, event) => sum + (event.dosageValue ?? 0), 0);
  const collectionRate = amountExpected > 0 ? (amountPaid / amountExpected) * 100 : 0;

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3 xl:grid-cols-5", className)}>
      <StatCard
        className="transition-transform hover:scale-[1.02]"
        title="Eventos"
        tone="primary"
        value={numberFormatter.format(eventsCount)}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        subtitle={`No show: ${numberFormatter.format(noShowCount)}`}
        title="Confirmados"
        tone="success"
        value={numberFormatter.format(confirmedCount)}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        subtitle={`${eventsCount > 0 ? ((noShowCount / eventsCount) * 100).toFixed(1) : "0.0"}% del día`}
        title="No Show"
        tone={noShowCount > 0 ? "warning" : "default"}
        value={numberFormatter.format(noShowCount)}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        subtitle={`${currencyFormatter.format(amountPaid)} de ${currencyFormatter.format(amountExpected)}`}
        suffix="%"
        title="Cobranza Día"
        tone={collectionRate >= 90 ? "success" : collectionRate >= 70 ? "warning" : "error"}
        value={collectionRate.toFixed(1)}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        subtitle={`Inducción ${inductionCount} · Mantención ${maintenanceCount} · Sin etapa ${withoutStageCount}`}
        title="Mix Etapa"
        tone="primary"
        value={`${inductionCount}/${maintenanceCount}`}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        subtitle={`${eventsCount > 0 ? (totalDosageMl / eventsCount).toFixed(2) : "0.00"} ml promedio por evento`}
        title="Dosis Total Día"
        value={`${totalDosageMl.toFixed(2)} ml`}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        title="Esperado"
        tone="warning"
        value={currencyFormatter.format(amountExpected)}
      />

      <StatCard
        className="transition-transform hover:scale-[1.02]"
        title="Pagado"
        tone="success"
        value={currencyFormatter.format(amountPaid)}
      />
    </div>
  );
}
