/**
 * Movement Type List Component
 * Shows breakdown by transaction type
 */

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { fmtCLP } from "@/lib/format";

import type { MovementTypeData } from "../types";

interface MovementTypeListProps {
  readonly data: MovementTypeData[];
}

export default function MovementTypeList({ data }: MovementTypeListProps) {
  if (data.length === 0) {
    return (
      <div className="text-default-500 py-6 text-center text-sm">
        No hay movimientos para mostrar
      </div>
    );
  }

  // Group by direction
  const incomingData = data.filter((item) => item.direction === "IN");
  const outgoingData = data.filter((item) => item.direction === "OUT");
  const neutralData = data.filter((item) => item.direction === "NEUTRO");

  const renderList = (
    items: MovementTypeData[],
    icon: React.ReactNode,
    title: string,
    colorClass: string,
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              className="hover:bg-default-50/50 flex items-center justify-between rounded-lg border border-transparent p-2 transition-colors"
              // biome-ignore lint/suspicious/noArrayIndexKey: simple list
              key={index}
            >
              <span className="text-sm">{item.description ?? "Sin categoría"}</span>
              <span className={`font-mono text-sm font-semibold ${colorClass}`}>
                {fmtCLP(item.total)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderList(
        incomingData,
        <ArrowUp className="text-success h-4 w-4" />,
        "Ingresos",
        "text-success",
      )}
      {renderList(
        outgoingData,
        <ArrowDown className="text-danger h-4 w-4" />,
        "Egresos",
        "text-danger",
      )}
      {renderList(
        neutralData,
        <Minus className="text-default-400 h-4 w-4" />,
        "Neutros",
        "text-default-600",
      )}
    </div>
  );
}
