import { Button, Chip, ProgressBar, Tooltip } from "@heroui/react";
import { ArrowDownToLine, Clipboard, RefreshCw, Settings } from "lucide-react";
import type { ReclassifyJob } from "../types";

interface ClassificationToolbarProps {
  isJobRunning: boolean;
  job: ReclassifyJob | null;
  loading: boolean;
  onReclassify: () => void;
  onReclassifyAll: () => void;
  onRefetch: () => void;
  onRebuild: () => void;
  onSync: () => void;
  progress: number;
  reclassifyAllPending: boolean;
  reclassifyPending: boolean;
  rebuildPending: boolean;
  syncPending: boolean;
}

export function ClassificationToolbar({
  loading,
  onRefetch,
  isJobRunning,
  progress,
  job,
  onReclassify,
  onReclassifyAll,
  onRebuild,
  onSync,
  reclassifyPending,
  reclassifyAllPending,
  rebuildPending,
  syncPending,
}: ClassificationToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Refresh Button */}
      <Button
        className="gap-2 text-default-600"
        isDisabled={loading}
        onPress={onRefetch}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCw className="h-4 w-4" />
        <span className="hidden sm:inline">{loading ? "Cargando..." : "Actualizar"}</span>
      </Button>

      {/* Action Buttons */}
      <Button
        className="relative gap-2 overflow-hidden"
        isDisabled={reclassifyPending || isJobRunning}
        onPress={onReclassify}
        type="button"
        variant="tertiary"
      >
        {isJobRunning && (
          <ProgressBar
            aria-label="Progreso de reclasificación"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
            size="sm"
            value={progress}
          >
            <ProgressBar.Track className="h-1 rounded-none bg-primary/10">
              <ProgressBar.Fill className="bg-primary/30" />
            </ProgressBar.Track>
          </ProgressBar>
        )}
        <span className="relative z-10 flex items-center gap-2">
          {isJobRunning ? (
            <>
              <RefreshCw className="h-4 w-4" />
              <span className="tabular-nums">{progress}%</span>
            </>
          ) : (
            <>
              <Clipboard className="h-4 w-4" />
              Reclasificar pendientes
            </>
          )}
        </span>
      </Button>

      {/* Progress info pill */}
      {isJobRunning && job && (
        <Chip color="accent" size="sm" variant="soft">
          <Chip.Label>{job.message}</Chip.Label>
          <span className="font-bold tabular-nums">
            {job.progress.toLocaleString("es-CL")}/{job.total.toLocaleString("es-CL")}
          </span>
        </Chip>
      )}

      <Tooltip>
        <Tooltip.Trigger>
          <Button
            aria-label="Reclasificar todo"
            isDisabled={reclassifyAllPending || isJobRunning}
            isIconOnly
            onPress={onReclassifyAll}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content
          className="bg-default-100 rounded-lg px-3 py-2 text-xs shadow-xl"
          placement="bottom"
          showArrow
        >
          Reclasificar TODO (sobrescribe existentes)
        </Tooltip.Content>
      </Tooltip>

      <Tooltip>
        <Tooltip.Trigger>
          <Button
            aria-label="Sincronizar calendario"
            isDisabled={syncPending || isJobRunning}
            isIconOnly
            onPress={onSync}
            size="sm"
            variant="outline"
          >
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content
          className="bg-default-100 rounded-lg px-3 py-2 text-xs shadow-xl"
          placement="bottom"
          showArrow
        >
          Sincronizar calendario y recalcular campos derivados
        </Tooltip.Content>
      </Tooltip>

      <Tooltip>
        <Tooltip.Trigger>
          <Button
            aria-label="Reagrupar series clínicas"
            isDisabled={rebuildPending || isJobRunning}
            isIconOnly
            onPress={onRebuild}
            size="sm"
            variant="outline"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content
          className="bg-default-100 rounded-lg px-3 py-2 text-xs shadow-xl"
          placement="bottom"
          showArrow
        >
          Reagrupar series clínicas para tests y tratamientos
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
