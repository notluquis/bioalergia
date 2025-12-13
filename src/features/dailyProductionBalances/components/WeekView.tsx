import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { ProductionBalance } from "../types";
import DayCard from "./DayCard";
import { currencyFormatter } from "@/lib/format";
import dayjsLib from "dayjs";

type WeekViewProps = {
  currentDate: dayjs.Dayjs;
  onDateChange: (date: dayjs.Dayjs) => void;
  balances: ProductionBalance[];
  onSelectDay: (date: string) => void;
  selectedDate: string | null;
};

export default function WeekView({ currentDate, onDateChange, balances, onSelectDay, selectedDate }: WeekViewProps) {
  const startOfWeek = currentDate.startOf("week").add(1, "day"); // Start on Monday
  const today = dayjsLib();
  const nextWeekStart = startOfWeek.add(7, "day");
  const canGoNextWeek = !nextWeekStart.isAfter(today, "day");
  const days = Array.from({ length: 6 })
    .map((_, i) => startOfWeek.add(i, "day")) // Monday to Saturday
    .filter((d) => !d.isAfter(today, "day")); // Hide future days

  // Calculate weekly totals
  const weeklyIncome = balances.reduce((acc, b) => acc + Number(b.total ?? 0), 0);
  const weeklyExpenses = balances.reduce((acc, b) => acc + Number(b.gastosDiarios ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => onDateChange(currentDate.subtract(1, "week"))}>
            <ChevronLeft size={12} />
          </Button>
          <h2 className="text-base-content text-xs font-semibold capitalize">{startOfWeek.format("MMM YYYY")}</h2>
          <Button
            variant="ghost"
            size="xs"
            disabled={!canGoNextWeek}
            onClick={() => {
              if (!canGoNextWeek) return;
              onDateChange(currentDate.add(1, "week"));
            }}
          >
            <ChevronRight size={12} />
          </Button>
        </div>

        <div className="flex gap-1.5 text-[11px]">
          <div className="bg-base-200/60 rounded px-2 py-0.5">
            <span className="text-base-content/60 text-[10px]">Semana actual · Ingresos</span>
            <span className="text-success ml-1 font-semibold">{currencyFormatter.format(weeklyIncome)}</span>
          </div>
          <div className="bg-base-200/60 rounded px-2 py-0.5">
            <span className="text-base-content/60 text-[10px]">Semana actual · Gastos</span>
            <span className="text-error ml-1 font-semibold">{currencyFormatter.format(weeklyExpenses)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-6">
        {days.map((day) => {
          const dateStr = day.format("YYYY-MM-DD");
          const balance = balances.find((b) => dayjsLib(b.date).isSame(day, "day"));
          const isSelected = selectedDate === dateStr;
          const isToday = day.isSame(dayjs(), "day");

          return (
            <DayCard
              key={dateStr}
              date={day}
              balance={balance}
              isSelected={isSelected}
              isToday={isToday}
              onClick={() => onSelectDay(dateStr)}
            />
          );
        })}
      </div>
    </div>
  );
}
