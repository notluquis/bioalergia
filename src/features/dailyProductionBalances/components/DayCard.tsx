import dayjs from "dayjs";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductionBalance } from "../types";

type DayCardProps = {
  date: dayjs.Dayjs;
  balance?: ProductionBalance;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
};

export default function DayCard({ date, balance, isSelected, isToday, onClick }: DayCardProps) {
  const status = balance?.status || "MISSING";
  const currencyFormatter = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-full min-h-[140px] w-full flex-col justify-between rounded-2xl border p-3 text-left transition-all hover:shadow-md",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-base-300 bg-base-100 hover:border-primary/50",
        isToday && !isSelected && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex w-full items-start justify-between">
        <div>
          <span className="block text-xs font-medium uppercase text-base-content/60">{date.format("ddd")}</span>
          <span className={cn("text-xl font-bold", isToday ? "text-primary" : "text-base-content")}>
            {date.format("D")}
          </span>
        </div>
        {status === "FINAL" && <CheckCircle2 size={18} className="text-success" />}
        {status === "DRAFT" && <CircleDashed size={18} className="text-warning" />}
        {status === "MISSING" && <div className="h-2 w-2 rounded-full bg-base-300" />}
      </div>

      <div className="mt-4 space-y-1">
        {balance ? (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-base-content/60">Ing.</span>
              <span className="font-medium text-base-content">{currencyFormatter.format(balance.total)}</span>
            </div>
            {balance.gastosDiarios > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-base-content/60">Gas.</span>
                <span className="font-medium text-error">{currencyFormatter.format(balance.gastosDiarios)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-end">
            <span className="text-xs text-base-content/40 group-hover:text-primary">Registrar</span>
          </div>
        )}
      </div>
    </button>
  );
}
