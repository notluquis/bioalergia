import { Label, ProgressBar } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobRadarSyncProgress } from "@finanzas/orpc-contracts/job-radar";

const PHASE_COLOR: Record<
  JobRadarSyncProgress["phase"],
  "default" | "accent" | "success" | "warning"
> = {
  idle: "default",
  fetching: "accent",
  saving: "warning",
  notifying: "accent",
  done: "success",
};

function fmtEta(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `~${s}s`;
  return `~${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Barra de progreso del sync (refresh). Muestra fase, avance fuentes y ETA.
 * `progress` viene del poll a `syncProgress`; `active` = el botón está corriendo.
 */
export function SyncProgressBar({
  progress,
  active,
}: {
  readonly progress: JobRadarSyncProgress | undefined;
  readonly active: boolean;
}) {
  const { t } = useTranslation();
  // ETA por fase: guardamos cuándo arrancó la fase actual para estimar el ritmo.
  const phaseStart = useRef<{ phase: string; at: number }>({ phase: "", at: Date.now() });
  const [, force] = useState(0);

  useEffect(() => {
    if (progress && progress.phase !== phaseStart.current.phase) {
      phaseStart.current = { phase: progress.phase, at: Date.now() };
    }
  }, [progress]);

  // Re-render cada 1s para que el ETA descuente entre polls.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active && (!progress || !progress.running)) return null;
  if (!progress) return null;

  const { phase, total, done, fetched } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const phaseLabel = t(`jobRadar.syncProgress.phase.${phase}`);

  // ETA: ritmo de la fase actual (tiempo/avance) × lo que falta.
  let eta: string | null = null;
  if (done > 0 && total > done && phase !== "done") {
    const elapsed = Date.now() - phaseStart.current.at;
    const remaining = (elapsed / done) * (total - done);
    if (remaining > 0) eta = fmtEta(remaining);
  }

  const indeterminate = total === 0 && phase !== "done";

  return (
    <div className="space-y-1 rounded-medium bg-default-100 p-3">
      <ProgressBar
        aria-label={phaseLabel}
        color={PHASE_COLOR[phase]}
        isIndeterminate={indeterminate}
        value={percent}
      >
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">
            {phaseLabel}
            {progress.currentLabel ? (
              <span className="ml-2 font-normal text-default-500">{progress.currentLabel}</span>
            ) : null}
          </Label>
          <span className="text-xs text-default-500">
            {total > 0 ? `${done}/${total}` : ""}
            {eta ? ` · ${eta}` : ""}
          </span>
        </div>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="text-xs text-default-500">
        {t("jobRadar.syncProgress.fetched", { count: fetched })}
      </p>
    </div>
  );
}
