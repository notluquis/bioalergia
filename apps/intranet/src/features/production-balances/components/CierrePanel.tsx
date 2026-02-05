import Button from "@/components/ui/Button";
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
    empty: "bg-default-100 text-default-500",
    unbalanced: "bg-danger/20 text-danger",
  };

  const canFinalize = summary.cuadra && summary.totalMetodos > 0;

  return (
    <aside
      className={cn(
        "sticky top-4 rounded-2xl border border-default-200 bg-default-50/50 p-4 backdrop-blur-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Cierre</h2>
        <span className={cn("rounded-full px-3 py-1 font-medium text-xs", statusColors[status])}>
          {statusLabels[status]}
        </span>
      </div>

      {/* Summary rows */}
      <div className="space-y-1 rounded-xl border border-default-100 bg-default-100/30 p-3">
        <SummaryRow label="Métodos" value={summary.totalMetodos} />
        <SummaryRow label="Servicios" value={summary.totalServicios} />
        <SummaryRow label="Gastos" muted value={summary.gastos} />

        {/* Diferencia - highlighted */}
        <div className="mt-2 border-default-200 border-t pt-2">
          <div className="flex items-baseline justify-between">
            <span
              className={cn(
                "font-medium text-sm",
                summary.cuadra ? "text-success" : "text-warning",
              )}
            >
              Diferencia
            </span>
            <span
              className={cn(
                "font-bold text-xl tabular-nums",
                summary.cuadra ? "text-success" : "text-warning",
              )}
            >
              {fmtCLP(summary.diferencia)}
            </span>
          </div>

          {!summary.cuadra && summary.totalMetodos > 0 && (
            <p className="mt-1 text-default-400 text-xs">
              {summary.diferencia > 0
                ? "Asigna más a servicios"
                : "Reduce servicios o aumenta métodos"}
            </p>
          )}
        </div>
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div className="mt-3 text-center text-default-300 text-xs">
          {isSaving ? "Guardando..." : `Guardado hace ${formatSaveTime(lastSaved)}`}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          isLoading={isSaving}
          isDisabled={isSaving}
          onPress={onSaveDraft}
        >
          Guardar
        </Button>
        <Button
          variant="success"
          className="flex-1 rounded-xl"
          isDisabled={!canFinalize || isSaving}
          onPress={onFinalize}
        >
          Finalizar
        </Button>
      </div>
    </aside>
  );
}

function SummaryRow({
  label,
  muted = false,
  value,
}: {
  label: string;
  muted?: boolean;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-sm", muted ? "text-default-300" : "text-default-500")}>
        {label}
      </span>
      <span
        className={cn("font-medium tabular-nums", muted ? "text-default-300" : "text-foreground")}
      >
        {fmtCLP(value)}
      </span>
    </div>
  );
}
