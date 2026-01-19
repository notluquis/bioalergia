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
      <div className="text-base-content/60 py-6 text-center text-sm">
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
              className="hover:bg-base-200/50 flex items-center justify-between rounded-lg border border-transparent p-2 transition-colors"
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
        <ArrowDown className="text-error h-4 w-4" />,
        "Egresos",
        "text-error",
      )}
      {renderList(
        neutralData,
        <Minus className="text-base-content/50 h-4 w-4" />,
        "Neutros",
        "text-base-content/70",
      )}
    </div>
  );
}
