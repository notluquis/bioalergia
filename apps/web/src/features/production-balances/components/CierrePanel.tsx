import { fmtCLP } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BalanceSummary, DayStatus } from "../types";
import { formatSaveTime } from "../utils";

interface CierrePanelProps {
  summary: BalanceSummary;
  status: DayStatus;
  lastSaved: Date | null;
  isSaving: boolean;
  onSaveDraft: () => void;
  onFinalize: () => void;
  className?: string;
}

/**
 * Sticky sidebar showing live summary and action buttons
 */
export function CierrePanel({
  summary,
  status,
  lastSaved,
  isSaving,
  onSaveDraft,
  onFinalize,
  className,
}: CierrePanelProps) {
  const statusLabels: Record<DayStatus, string> = {
    empty: "Vacío",
    draft: "Borrador",
    balanced: "Cuadra",
    unbalanced: "Pendiente",
  };

  const statusColors: Record<DayStatus, string> = {
    empty: "bg-base-content/10 text-base-content/60",
    draft: "bg-warning/20 text-warning",
    balanced: "bg-success/20 text-success",
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
        <SummaryRow label="Gastos" value={summary.gastos} muted />

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
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving}
          className={cn("btn btn-outline flex-1 rounded-xl", isSaving && "loading")}
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onFinalize}
          disabled={!canFinalize || isSaving}
          className={cn("btn flex-1 rounded-xl", canFinalize ? "btn-success" : "btn-disabled")}
        >
          Finalizar
        </button>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-sm", muted ? "text-base-content/40" : "text-base-content/60")}>{label}</span>
      <span className={cn("font-medium tabular-nums", muted ? "text-base-content/40" : "text-base-content")}>
        {fmtCLP(value)}
      </span>
    </div>
  );
}
