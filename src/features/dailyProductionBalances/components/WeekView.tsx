import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { ProductionBalance } from "../types";
import DayCard from "./DayCard";

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

  const currencyFormatter = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onDateChange(currentDate.subtract(1, "week"))}>
            <ChevronLeft size={20} />
          </Button>
          <h2 className="text-base-content text-lg font-semibold capitalize">{startOfWeek.format("MMMM YYYY")}</h2>
          <Button variant="ghost" size="sm" onClick={() => onDateChange(currentDate.add(1, "week"))}>
            <ChevronRight size={20} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDateChange(dayjs())}>
            Hoy
          </Button>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="bg-base-200/50 rounded-xl px-3 py-2">
            <span className="text-base-content/60 block text-xs">Ingresos Semanales</span>
            <span className="text-success font-semibold">{currencyFormatter.format(weeklyIncome)}</span>
          </div>
          <div className="bg-base-200/50 rounded-xl px-3 py-2">
            <span className="text-base-content/60 block text-xs">Gastos Semanales</span>
            <span className="text-error font-semibold">{currencyFormatter.format(weeklyExpenses)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
