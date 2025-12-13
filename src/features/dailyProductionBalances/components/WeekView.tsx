import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { ProductionBalance } from "../types";
import DayCard from "./DayCard";
import { currencyFormatter } from "@/lib/format";

type WeekViewProps = {
  currentDate: dayjs.Dayjs;
  onDateChange: (date: dayjs.Dayjs) => void;
  balances: ProductionBalance[];
  onSelectDay: (date: string) => void;
  selectedDate: string | null;
};

export default function WeekView({ currentDate, onDateChange, balances, onSelectDay, selectedDate }: WeekViewProps) {
  const startOfWeek = currentDate.startOf("week").add(1, "day"); // Start on Monday
  const days = Array.from({ length: 6 }).map((_, i) => startOfWeek.add(i, "day")); // Monday to Saturday

  // Calculate weekly totals
  const weeklyIncome = balances.reduce((acc, b) => acc + Number(b.total), 0);
  const weeklyExpenses = balances.reduce((acc, b) => acc + Number(b.gastosDiarios), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => onDateChange(currentDate.subtract(1, "week"))}>
            <ChevronLeft size={12} />
          </Button>
          <h2 className="text-base-content text-xs font-semibold capitalize">{startOfWeek.format("MMM YYYY")}</h2>
          <Button variant="ghost" size="xs" onClick={() => onDateChange(currentDate.add(1, "week"))}>
            <ChevronRight size={12} />
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onDateChange(dayjs())}>
            Hoy
          </Button>
        </div>

        <div className="flex gap-1.5 text-[11px]">
          <div className="bg-base-200/60 rounded px-2 py-0.5">
            <span className="text-base-content/60 text-[10px]">Ingresos</span>
            <span className="text-success ml-1 font-semibold">{currencyFormatter.format(weeklyIncome)}</span>
          </div>
          <div className="bg-base-200/60 rounded px-2 py-0.5">
            <span className="text-base-content/60 text-[10px]">Gastos</span>
            <span className="text-error ml-1 font-semibold">{currencyFormatter.format(weeklyExpenses)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {days.map((day) => {
          const dateStr = day.format("YYYY-MM-DD");
          const balance = balances.find((b) => b.date === dateStr);
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
