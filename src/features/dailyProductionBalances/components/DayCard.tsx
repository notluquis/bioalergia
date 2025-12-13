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
  const total = Number(balance?.total ?? 0);
  const gastos = Number(balance?.gastosDiarios ?? 0);
  const hasMoney = total > 0 || gastos > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group border-base-200 relative flex h-full min-h-20 w-full flex-col justify-between rounded-md border p-1 text-left transition-all hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 ring-primary ring-1"
          : "border-base-300 bg-base-100 hover:border-primary/50",
        isToday && !isSelected && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex w-full items-start justify-between">
        <div>
          <span className="text-base-content/60 block text-[10px] font-medium uppercase">{date.format("ddd")}</span>
          <span className={cn("text-sm font-bold", isToday ? "text-primary" : "text-base-content")}>
            {date.format("D")}
          </span>
        </div>
        {status === "FINAL" && <CheckCircle2 size={12} className="text-success" />}
        {status === "DRAFT" && <CircleDashed size={12} className="text-warning" />}
        {status === "MISSING" && <div className="bg-base-300 h-1.5 w-1.5 rounded-full" />}
      </div>

      <div className="mt-1 space-y-0.5 text-[10px]">
        {balance ? (
          <>
            <div className="flex items-center justify-between gap-1 leading-tight">
              <span className="text-base-content/60 text-[10px]">Ing.</span>
              <span className="text-base-content text-[11px] leading-tight font-semibold">
                {currencyFormatter.format(total)}
              </span>
            </div>
            {gastos > 0 && (
              <div className="flex items-center justify-between gap-1 leading-tight">
                <span className="text-base-content/60 text-[10px]">Gas.</span>
                <span className="text-error text-[11px] leading-tight font-semibold">
                  {currencyFormatter.format(gastos)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-end">
            <span className="text-base-content/60 group-hover:text-primary">
              {hasMoney ? "Ver detalle" : "Registrar"}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
