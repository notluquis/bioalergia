import { Button, Card, Chip, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import type { CalendarSyncStep } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";

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
}: Readonly<SyncProgressPanelProps>) {
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

  const getStatusColor = (
    status: SyncProgressStatus,
  ): "accent" | "danger" | "warning" | "default" => {
    switch (status) {
      case "completed":
        return "accent";
      case "error":
        return "danger";
      case "in_progress":
        return "warning";
      default:
        return "default";
    }
  };

  const dotClass: Record<SyncProgressStatus, string> = {
    completed: "bg-secondary",
    error: "bg-danger",
    in_progress: "bg-primary animate-pulse",
    pending: "bg-default-300",
  };

  const detailLabels: Record<string, string> = {
    calendars: "Calendarios",
    events: "Eventos",
    inserted: "Nuevas",
    stored: "Snapshot",
    updated: "Actualizadas",
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy logic
  const formatDetails = (details: Record<string, unknown>) => {
    const parts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- details can be null/undefined
    for (const [key, rawValue] of Object.entries(details ?? {})) {
      if (rawValue == null) continue;
      const label = detailLabels[key] ?? key; // eslint-disable-line security/detect-object-injection
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
    <Card className="rounded-2xl shadow-md p-5">
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
          {syncing && <Spinner size="sm" aria-label="Sincronizando" />}
          {syncError && (
            <span className="text-error text-xs font-semibold">Revisa los detalles abajo.</span>
          )}
          {!syncing && syncDurationMs != null && !syncError && (
            <Chip size="sm" variant="soft" className="text-xs">
              Duración total: {formatDuration(syncDurationMs)}
            </Chip>
          )}
        </div>
        <div className="flex gap-2">
          <Chip size="sm" variant="soft" className="text-xs text-base-content/70">
            {lastSyncInfo && !syncing && !syncError
              ? dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY · HH:mm")
              : dayjs().format("DD MMM YYYY · HH:mm")}
          </Chip>
          {showSyncButton && onSyncNow && (
            <Button
              isDisabled={syncing}
              onPress={onSyncNow}
              size="sm"
              className="bg-secondary text-white font-medium"
            >
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

      {syncError && <p className="text-danger mt-3 text-xs">{syncError}</p>}

      {syncProgress.length > 0 && (
        <ul className="mt-4 space-y-3">
          {syncProgress.map((step) => {
            const status = statusLabelMap[step.status];
            const details = formatDetails(step.details);
            const duration = formatDuration(step.durationMs);
            return (
              <li
                className="border-base-300/60 bg-base-100/70 rounded-2xl border px-4 py-3"
                key={step.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotClass[step.status]}`} />
                    <p className="text-base-content text-sm font-semibold">{step.label}</p>
                  </div>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={getStatusColor(step.status)}
                    className="text-xs font-semibold"
                  >
                    {status}
                  </Chip>
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
    </Card>
  );
}
