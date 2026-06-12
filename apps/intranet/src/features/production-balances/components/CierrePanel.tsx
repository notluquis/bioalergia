import { Button, Surface } from "@heroui/react";
import { fmtCLP } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DAY_STATUS_CHIP_CLASSES, DAY_STATUS_LABELS } from "../labels";
import type { BalanceSummary, DayStatus } from "../types";

import { formatSaveTime } from "../utils";

interface CierrePanelProps {
  className?: string;
  isFinalized: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  onFinalize: () => Promise<void> | void;
  onReopen: () => Promise<void> | void;
  onSaveDraft: () => Promise<void> | void;
  status: DayStatus;
  summary: BalanceSummary;
}

/**
 * Sticky sidebar showing live summary and action buttons
 */
export function CierrePanel({
  className,
  isFinalized,
  isSaving,
  lastSaved,
  onFinalize,
  onReopen,
  onSaveDraft,
  status,
  summary,
}: CierrePanelProps) {
  const canFinalize = summary.cuadra && summary.totalMetodos > 0;

  return (
    <aside className={className}>
      <Surface
        className="sticky top-4 rounded-[28px] p-4 backdrop-blur-sm md:p-5"
        variant="secondary"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Cierre</h2>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-medium text-xs",
              DAY_STATUS_CHIP_CLASSES[status]
            )}
          >
            {DAY_STATUS_LABELS[status]}
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
                  summary.cuadra ? "text-success" : "text-warning"
                )}
              >
                Diferencia
              </span>
              <span
                className={cn(
                  "font-bold text-xl tabular-nums",
                  summary.cuadra ? "text-success" : "text-warning"
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
        <div className="mt-4 hidden gap-2 lg:flex">
          {isFinalized ? (
            <Button
              className="flex-1 rounded-xl"
              isDisabled={isSaving}
              onPress={() => {
                void onReopen();
              }}
              variant="outline"
            >
              Reabrir día
            </Button>
          ) : (
            <>
              <Button
                className="flex-1 rounded-xl"
                isDisabled={isSaving}
                isPending={isSaving}
                onPress={() => {
                  void onSaveDraft();
                }}
                variant="outline"
              >
                Guardar
              </Button>
              <Button
                className="flex-1 rounded-xl"
                isDisabled={!canFinalize || isSaving}
                onPress={() => {
                  void onFinalize();
                }}
                variant="primary"
              >
                Finalizar
              </Button>
            </>
          )}
        </div>
      </Surface>
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
