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
      <div className="py-6 text-center text-default-500 text-sm">
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
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          {title}
        </h3>
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              className="flex items-center justify-between rounded-lg border border-transparent p-2 transition-colors hover:bg-default-50/50"
              // biome-ignore lint/suspicious/noArrayIndexKey: simple list
              key={index}
            >
              <span className="text-sm">{item.description ?? "Sin categoría"}</span>
              <span className={`font-mono font-semibold text-sm ${colorClass}`}>
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
        <ArrowUp className="h-4 w-4 text-success" />,
        "Ingresos",
        "text-success",
      )}
      {renderList(
        outgoingData,
        <ArrowDown className="h-4 w-4 text-danger" />,
        "Egresos",
        "text-danger",
      )}
      {renderList(
        neutralData,
        <Minus className="h-4 w-4 text-default-400" />,
        "Neutros",
        "text-default-600",
      )}
    </div>
  );
}
