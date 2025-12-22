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
      <div className="from-primary/10 to-primary/5 ring-primary/20 rounded-2xl bg-linear-to-br p-5 shadow-sm ring-1 transition-transform hover:scale-[1.02]">
        <div className="text-primary/70 text-xs font-bold tracking-wide uppercase">Eventos</div>
        <div className="text-primary mt-1 text-2xl font-bold tabular-nums">{numberFormatter.format(eventsCount)}</div>
      </div>

      <div className="from-warning/10 to-warning/5 ring-warning/20 rounded-2xl bg-linear-to-br p-5 shadow-sm ring-1 transition-transform hover:scale-[1.02]">
        <div className="text-warning/70 text-xs font-bold tracking-wide uppercase">Esperado</div>
        <div className="text-warning mt-1 text-2xl font-bold tabular-nums">
          {currencyFormatter.format(amountExpected)}
        </div>
      </div>

      <div className="from-success/10 to-success/5 ring-success/20 rounded-2xl bg-linear-to-br p-5 shadow-sm ring-1 transition-transform hover:scale-[1.02]">
        <div className="text-success/70 text-xs font-bold tracking-wide uppercase">Pagado</div>
        <div className="text-success mt-1 text-2xl font-bold tabular-nums">{currencyFormatter.format(amountPaid)}</div>
      </div>
    </div>
  );
}
