import { fmtCLP } from "../../../lib/format";
import type { StatsResponse } from "../types";

interface MovementTypeListProps {
  data: StatsResponse["byType"];
}

export default function MovementTypeList({ data }: MovementTypeListProps) {
  if (!data.length) {
    return <p className="text-xs text-base-content/60">Sin movimientos en el rango.</p>;
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = Math.max(...sorted.map((item) => Math.abs(item.total)));

  return (
    <div className="space-y-3">
      {sorted.map((row, index) => {
        const width = max ? Math.min((Math.abs(row.total) / max) * 100, 100) : 0;
        const colorClass =
          row.direction === "IN" ? "bg-success/70" : row.direction === "OUT" ? "bg-error/70" : "bg-base-300";
        return (
          <div key={`${row.description ?? "(sin descripción)"}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-base-content/60">
              <span className="font-medium text-base-content">{row.description ?? "(sin descripción)"}</span>
              <span>{row.direction === "OUT" ? `-${fmtCLP(row.total)}` : fmtCLP(row.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-base-200">
              <div className={`h-full ${colorClass}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
