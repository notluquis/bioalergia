import dayjs from "dayjs";

import type { CalendarSyncStep } from "@/features/calendar/types";

import Button from "@/components/ui/Button";
import { numberFormatter } from "@/lib/format";
import { LOADING_SPINNER_SM } from "@/lib/styles";

import "dayjs/locale/es";

interface LastSyncInfo {
  excluded: number;
  fetchedAt: string;
  inserted: number;
  logId?: number;
  skipped: number;
  updated: number;
}

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

interface SyncProgressPanelProps {
  lastSyncInfo?: LastSyncInfo | null;
  onSyncNow?: () => void;
  showLastSyncInfo?: boolean;
  showSyncButton?: boolean;
  syncDurationMs: null | number;
  syncError: null | string;
  syncing: boolean;
  syncProgress: SyncProgressEntry[];
}

type SyncProgressStatus = "completed" | "error" | "in_progress" | "pending";

const formatDuration = (value: number) => {
  if (!value) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
};

export function SyncProgressPanel({
  lastSyncInfo,
  onSyncNow,
  showLastSyncInfo = false,
  showSyncButton = false,
  syncDurationMs,
  syncError,
  syncing,
  syncProgress,
}: SyncProgressPanelProps) {
  const hasProgress = syncProgress.length > 0;
  if (!syncing && !syncError && !hasProgress) {
    return null;
  }

  const statusLabelMap: Record<SyncProgressStatus, string> = {
    completed: "Listo",
    error: "Error",
    in_progress: "En progreso",
    pending: "Pendiente",
  };

  const badgeClass: Record<SyncProgressStatus, string> = {
    completed: "bg-secondary/20 text-secondary",
    error: "bg-error/20 text-error",
    in_progress: "bg-primary/15 text-primary",
    pending: "bg-base-200 text-base-content/70",
  };

  const dotClass: Record<SyncProgressStatus, string> = {
    completed: "bg-secondary",
    error: "bg-error",
    in_progress: "bg-primary animate-pulse",
    pending: "bg-base-300",
  };

  const detailLabels: Record<string, string> = {
    calendars: "Calendarios",
    events: "Eventos",
    inserted: "Nuevas",
    stored: "Snapshot",
    updated: "Actualizadas",
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const parts: string[] = [];
    for (const [key, rawValue] of Object.entries(details ?? {})) {
      if (rawValue == null) continue;
      const label = detailLabels[key] ?? key;
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        parts.push(`${label}: ${numberFormatter.format(rawValue)}`);
      } else if (typeof rawValue === "boolean") {
        parts.push(`${label}: ${rawValue ? "Sí" : "No"}`);
      } else if (typeof rawValue === "string" && rawValue.length > 0) {
        parts.push(`${label}: ${rawValue}`);
      }
    }
    return parts.join(" · ");
  };

  return (
    <section className="surface-elevated rounded-2xl p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-base-200/60 rounded-xl px-3 py-2">
            <p className="text-base-content text-sm font-semibold">
              {(() => {
                if (syncError) return "Error al sincronizar";
                if (syncing) return "Sincronizando calendario";
                return "Sincronización completada";
              })()}
            </p>
            <p className="text-base-content/60 text-xs">
              {(() => {
                if (syncing) return "Consultando eventos y actualizando la base.";
                if (syncError) return "Vuelve a intentar más tarde.";
                return "Última ejecución completada correctamente.";
              })()}
            </p>
          </div>
          {syncing && <span aria-label="Sincronizando" className={LOADING_SPINNER_SM} />}
          {syncError && <span className="text-error text-xs font-semibold">Revisa los detalles abajo.</span>}
          {!syncing && syncDurationMs != null && !syncError && (
            <span className="bg-base-200 text-base-content/70 rounded-full px-3 py-1 text-xs">
              Duración total: {formatDuration(syncDurationMs)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <span className="bg-base-200/80 text-base-content/70 rounded-full px-3 py-1 text-xs">
            {lastSyncInfo && !syncing && !syncError
              ? dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY · HH:mm")
              : dayjs().format("DD MMM YYYY · HH:mm")}
          </span>
          {showSyncButton && onSyncNow && (
            <Button disabled={syncing} onClick={onSyncNow} size="sm" type="button" variant="secondary">
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          )}
        </div>
      </div>

      {showLastSyncInfo && lastSyncInfo && !syncing && !syncError && (
        <div className="text-base-content mt-4 grid gap-2 text-xs md:grid-cols-2">
          <p>
            <span className="text-base-content font-semibold">Nuevas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.inserted)}
          </p>
          <p>
            <span className="text-base-content font-semibold">Actualizadas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.updated)}
          </p>
          <p className="text-base-content/60 md:col-span-2">
            Ejecutado el {dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY · HH:mm")}
          </p>
        </div>
      )}

      {syncError && <p className="text-error mt-3 text-xs">{syncError}</p>}

      {syncProgress.length > 0 && (
        <ul className="mt-4 space-y-3">
          {syncProgress.map((step) => {
            const status = statusLabelMap[step.status];
            const details = formatDetails(step.details);
            const duration = formatDuration(step.durationMs);
            return (
              <li className="border-base-300/60 bg-base-100/70 rounded-2xl border px-4 py-3" key={step.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotClass[step.status]}`} />
                    <p className="text-base-content text-sm font-semibold">{step.label}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass[step.status]}`}>
                    {status}
                  </span>
                </div>
                {(details || duration) && (
                  <p className="text-base-content/60 mt-2 text-xs">
                    {details}
                    {details && duration ? " · " : ""}
                    {duration ? `Tiempo: ${duration}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
