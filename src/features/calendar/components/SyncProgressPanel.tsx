import dayjs from "dayjs";
import "dayjs/locale/es";

import Button from "@/components/ui/Button";
import { LOADING_SPINNER_SM } from "@/lib/styles";
import { numberFormatter } from "@/lib/format";
import type { CalendarSyncStep } from "@/features/calendar/types";

type SyncProgressStatus = "pending" | "in_progress" | "completed" | "error";

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

interface LastSyncInfo {
  inserted: number;
  updated: number;
  skipped: number;
  excluded: number;
  fetchedAt: string;
  logId?: number;
}

interface SyncProgressPanelProps {
  syncing: boolean;
  syncError: string | null;
  syncProgress: SyncProgressEntry[];
  syncDurationMs: number | null;
  lastSyncInfo?: LastSyncInfo | null;
  onSyncNow?: () => void;
  showSyncButton?: boolean;
  showLastSyncInfo?: boolean;
}

export function SyncProgressPanel({
  syncing,
  syncError,
  syncProgress,
  syncDurationMs,
  lastSyncInfo,
  onSyncNow,
  showSyncButton = false,
  showLastSyncInfo = false,
}: SyncProgressPanelProps) {
  const hasProgress = syncProgress.length > 0;
  if (!syncing && !syncError && !hasProgress) {
    return null;
  }

  const title = syncError ? "Error al sincronizar" : syncing ? "Sincronizando calendario" : "Sincronización completada";

  const statusLabelMap: Record<SyncProgressStatus, string> = {
    pending: "Pendiente",
    in_progress: "En progreso",
    completed: "Listo",
    error: "Error",
  };

  const badgeClass: Record<SyncProgressStatus, string> = {
    pending: "bg-base-200 text-base-content/70",
    in_progress: "bg-primary/15 text-primary",
    completed: "bg-secondary/20 text-secondary",
    error: "bg-error/20 text-error",
  };

  const dotClass: Record<SyncProgressStatus, string> = {
    pending: "bg-base-300",
    in_progress: "bg-primary animate-pulse",
    completed: "bg-secondary",
    error: "bg-error",
  };

  const detailLabels: Record<string, string> = {
    calendars: "Calendarios",
    events: "Eventos",
    inserted: "Nuevas",
    updated: "Actualizadas",
    skipped: "Omitidas",
    excluded: "Excluidas",
    stored: "Snapshot",
  };

  const formatDuration = (value: number) => {
    if (!value) return null;
    if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
    return `${Math.round(value)} ms`;
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const parts: string[] = [];
    Object.entries(details ?? {}).forEach(([key, rawValue]) => {
      if (rawValue == null) return;
      const label = detailLabels[key] ?? key;
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        parts.push(`${label}: ${numberFormatter.format(rawValue)}`);
      } else if (typeof rawValue === "boolean") {
        parts.push(`${label}: ${rawValue ? "Sí" : "No"}`);
      } else if (typeof rawValue === "string" && rawValue.length) {
        parts.push(`${label}: ${rawValue}`);
      }
    });
    return parts.join(" · ");
  };

  return (
    <section className="surface-elevated rounded-2xl p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-base-200/60 rounded-xl px-3 py-2">
            <p className="text-base-content text-sm font-semibold">{title}</p>
            <p className="text-base-content/60 text-xs">
              {syncing
                ? "Consultando eventos y actualizando la base."
                : syncError
                  ? "Vuelve a intentar más tarde."
                  : "Última ejecución completada correctamente."}
            </p>
          </div>
          {syncing && <span className={LOADING_SPINNER_SM} aria-label="Sincronizando" />}
          {syncError && <span className="text-error text-xs font-semibold">Revisa los detalles abajo.</span>}
          {!syncing && syncDurationMs != null && !syncError && (
            <span className="bg-base-200 text-base-content/70 rounded-full px-3 py-1 text-xs">
              Duración total: {formatDuration(syncDurationMs)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <span className="bg-base-200/80 text-base-content/70 rounded-full px-3 py-1 text-xs">
            {dayjs().format("DD MMM YYYY · HH:mm")}
          </span>
          {showSyncButton && onSyncNow && (
            <Button type="button" variant="secondary" size="sm" disabled={syncing} onClick={onSyncNow}>
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
          <p>
            <span className="text-base-content font-semibold">Omitidas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.skipped)}
          </p>
          <p>
            <span className="text-base-content font-semibold">Filtradas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.excluded)}
          </p>
          <p className="text-base-content/60 md:col-span-2">
            Ejecutado el {dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY HH:mm")}
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
              <li key={step.id} className="border-base-300/60 bg-base-100/70 rounded-2xl border px-4 py-3">
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
