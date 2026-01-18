import { StatCard } from "@/components/ui/StatCard";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DailyStatsCardsProps {
  amountExpected: number;
  amountPaid: number;
  className?: string;
  eventsCount: number;
}

export function DailyStatsCards({
  amountExpected,
  amountPaid,
  className,
  eventsCount,
}: Readonly<DailyStatsCardsProps>) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      <StatCard
        className="transition-transform hover:scale-[1.02]"
        title="Eventos"
        tone="primary"
        value={numberFormatter.format(eventsCount)}
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
