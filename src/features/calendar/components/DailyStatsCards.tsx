import { StatCard } from "@/components/ui/StatCard";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DailyStatsCardsProps {
  eventsCount: number;
  amountExpected: number;
  amountPaid: number;
  className?: string;
}

export function DailyStatsCards({ eventsCount, amountExpected, amountPaid, className }: DailyStatsCardsProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      <StatCard
        title="Eventos"
        value={numberFormatter.format(eventsCount)}
        tone="primary"
        className="transition-transform hover:scale-[1.02]"
      />

      <StatCard
        title="Esperado"
        value={currencyFormatter.format(amountExpected)}
        tone="warning"
        className="transition-transform hover:scale-[1.02]"
      />

      <StatCard
        title="Pagado"
        value={currencyFormatter.format(amountPaid)}
        tone="success"
        className="transition-transform hover:scale-[1.02]"
      />
    </div>
  );
}
