import { fmtCLP } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BalanceSummary, DayStatus } from "../types";

import { formatSaveTime } from "../utils";

interface CierrePanelProps {
  className?: string;
  isSaving: boolean;
  lastSaved: Date | null;
  onFinalize: () => void;
  onSaveDraft: () => void;
  status: DayStatus;
  summary: BalanceSummary;
}

/**
 * Sticky sidebar showing live summary and action buttons
 */
export function CierrePanel({
  className,
  isSaving,
  lastSaved,
  onFinalize,
  onSaveDraft,
  status,
  summary,
}: CierrePanelProps) {
  const statusLabels: Record<DayStatus, string> = {
    balanced: "Cuadra",
    draft: "Borrador",
    empty: "Vacío",
    unbalanced: "Pendiente",
  };

  const statusColors: Record<DayStatus, string> = {
    balanced: "bg-success/20 text-success",
    draft: "bg-warning/20 text-warning",
    empty: "bg-base-content/10 text-base-content/60",
    unbalanced: "bg-error/20 text-error",
  };

  const canFinalize = summary.cuadra && summary.totalMetodos > 0;

  return (
    <aside
      className={cn(
        "bg-base-200/50 border-base-content/10 sticky top-4 rounded-2xl border p-4 backdrop-blur-sm",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cierre</h2>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusColors[status])}>
          {statusLabels[status]}
        </span>
      </div>

      {/* Summary rows */}
      <div className="bg-base-300/30 border-base-content/5 space-y-1 rounded-xl border p-3">
        <SummaryRow label="Métodos" value={summary.totalMetodos} />
        <SummaryRow label="Servicios" value={summary.totalServicios} />
        <SummaryRow label="Gastos" muted value={summary.gastos} />

        {/* Diferencia - highlighted */}
        <div className="border-base-content/10 mt-2 border-t pt-2">
          <div className="flex items-baseline justify-between">
            <span className={cn("text-sm font-medium", summary.cuadra ? "text-success" : "text-warning")}>
              Diferencia
            </span>
            <span className={cn("text-xl font-bold tabular-nums", summary.cuadra ? "text-success" : "text-warning")}>
              {fmtCLP(summary.diferencia)}
            </span>
          </div>

          {!summary.cuadra && summary.totalMetodos > 0 && (
            <p className="text-base-content/50 mt-1 text-xs">
              {summary.diferencia > 0 ? "Asigna más a servicios" : "Reduce servicios o aumenta métodos"}
            </p>
          )}
        </div>
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div className="text-base-content/40 mt-3 text-center text-xs">
          {isSaving ? "Guardando..." : `Guardado hace ${formatSaveTime(lastSaved)}`}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <button
          className={cn("btn btn-outline flex-1 rounded-xl", isSaving && "loading")}
          disabled={isSaving}
          onClick={onSaveDraft}
          type="button"
        >
          Guardar
        </button>
        <button
          className={cn("btn flex-1 rounded-xl", canFinalize ? "btn-success" : "btn-disabled")}
          disabled={!canFinalize || isSaving}
          onClick={onFinalize}
          type="button"
        >
          Finalizar
        </button>
      </div>
    </aside>
  );
}

function SummaryRow({ label, muted = false, value }: { label: string; muted?: boolean; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-sm", muted ? "text-base-content/40" : "text-base-content/60")}>{label}</span>
      <span className={cn("font-medium tabular-nums", muted ? "text-base-content/40" : "text-base-content")}>
        {fmtCLP(value)}
      </span>
    </div>
  );
}
