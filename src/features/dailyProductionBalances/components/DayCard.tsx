import dayjs from "dayjs";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductionBalance } from "../types";
import { currencyFormatter } from "@/lib/format";

type DayCardProps = {
  date: dayjs.Dayjs;
  balance?: ProductionBalance;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
};

export default function DayCard({ date, balance, isSelected, isToday, onClick }: DayCardProps) {
  const status = balance?.status || "MISSING";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-full min-h-25 w-full flex-col justify-between rounded-lg border p-2 text-left transition-all hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 ring-primary ring-1"
          : "border-base-300 bg-base-100 hover:border-primary/50",
        isToday && !isSelected && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex w-full items-start justify-between">
        <div>
          <span className="text-base-content/60 block text-[10px] font-medium uppercase">{date.format("ddd")}</span>
          <span className={cn("text-lg font-bold", isToday ? "text-primary" : "text-base-content")}>
            {date.format("D")}
          </span>
        </div>
        {status === "FINAL" && <CheckCircle2 size={14} className="text-success" />}
        {status === "DRAFT" && <CircleDashed size={14} className="text-warning" />}
        {status === "MISSING" && <div className="bg-base-300 h-1.5 w-1.5 rounded-full" />}
      </div>

      <div className="mt-2 space-y-0.5">
        {balance ? (
          <>
            <div className="flex justify-between text-[10px]">
              <span className="text-base-content/60">Ing.</span>
              <span className="text-base-content font-medium">{currencyFormatter.format(balance.total)}</span>
            </div>
            {balance.gastosDiarios > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="text-base-content/60">Gas.</span>
                <span className="text-error font-medium">{currencyFormatter.format(balance.gastosDiarios)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-end">
            <span className="text-base-content/40 group-hover:text-primary text-[10px]">Registrar</span>
          </div>
        )}
      </div>
    </button>
  );
}
