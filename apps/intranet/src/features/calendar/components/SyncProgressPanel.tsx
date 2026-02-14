import { Button, Card, Chip, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import type { CalendarSyncStep } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";

import "dayjs/locale/es";

interface LastSyncInfo {
  excluded: number;
  fetchedAt: Date;
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
  if (!value) {
    return null;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${Math.round(value)} ms`;
};

const detailLabels: Record<string, string> = {
  calendars: "Calendarios",
  events: "Eventos",
  inserted: "Nuevas",
  stored: "Snapshot",
  updated: "Actualizadas",
};

function formatDetailValue(rawValue: unknown): null | string {
  if (rawValue == null) {
    return null;
  }
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return numberFormatter.format(rawValue);
  }
  if (typeof rawValue === "boolean") {
    return rawValue ? "Sí" : "No";
  }
  if (typeof rawValue === "string" && rawValue.length > 0) {
    return rawValue;
  }
  return null;
}

function formatStepDetails(details: Record<string, unknown>) {
  return Object.entries(details ?? {})
    .map(([key, rawValue]) => {
      const value = formatDetailValue(rawValue);
      if (!value) {
        return null;
      }
      const label = detailLabels[key] ?? key; // eslint-disable-line security/detect-object-injection
      return `${label}: ${value}`;
    })
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function getPanelTitle(syncError: null | string, syncing: boolean) {
  if (syncError) {
    return "Error al sincronizar";
  }
  if (syncing) {
    return "Sincronizando calendario";
  }
  return "Sincronización completada";
}

function getPanelSubtitle(syncError: null | string, syncing: boolean) {
  if (syncing) {
    return "Consultando eventos y actualizando la base.";
  }
  if (syncError) {
    return "Vuelve a intentar más tarde.";
  }
  return "Última ejecución completada correctamente.";
}

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

  const statusColorMap: Record<SyncProgressStatus, "accent" | "danger" | "warning" | "default"> = {
    completed: "accent",
    error: "danger",
    in_progress: "warning",
    pending: "default",
  };

  const getStatusColor = (status: SyncProgressStatus) => statusColorMap[status];

  const dotClass: Record<SyncProgressStatus, string> = {
    completed: "bg-secondary",
    error: "bg-danger",
    in_progress: "bg-primary animate-pulse",
    pending: "bg-default-300",
  };

  return (
    <Card className="rounded-2xl p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-default-100/60 px-3 py-2">
            <p className="font-semibold text-foreground text-sm">
              {getPanelTitle(syncError, syncing)}
            </p>
            <p className="text-foreground-500 text-xs">{getPanelSubtitle(syncError, syncing)}</p>
          </div>
          {syncing && <Spinner size="sm" aria-label="Sincronizando" />}
          {syncError && (
            <span className="font-semibold text-danger text-xs">Revisa los detalles abajo.</span>
          )}
          {!syncing && syncDurationMs != null && !syncError && (
            <Chip size="sm" variant="soft" className="text-xs">
              Duración total: {formatDuration(syncDurationMs)}
            </Chip>
          )}
        </div>
        <div className="flex gap-2">
          <Chip size="sm" variant="soft" className="text-foreground-600 text-xs">
            {lastSyncInfo && !syncing && !syncError
              ? dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY · HH:mm")
              : dayjs().format("DD MMM YYYY · HH:mm")}
          </Chip>
          {showSyncButton && onSyncNow && (
            <Button
              isDisabled={syncing}
              onPress={onSyncNow}
              size="sm"
              className="bg-secondary font-medium text-white"
            >
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          )}
        </div>
      </div>

      {showLastSyncInfo && lastSyncInfo && !syncing && !syncError && (
        <div className="mt-4 grid gap-2 text-foreground text-xs md:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground">Nuevas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.inserted)}
          </p>
          <p>
            <span className="font-semibold text-foreground">Actualizadas:</span>{" "}
            {numberFormatter.format(lastSyncInfo.updated)}
          </p>
          <p className="text-foreground-500 md:col-span-2">
            Ejecutado el {dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY · HH:mm")}
          </p>
        </div>
      )}

      {syncError && <p className="mt-3 text-danger text-xs">{syncError}</p>}

      {syncProgress.length > 0 && (
        <ul className="mt-4 space-y-3">
          {syncProgress.map((step) => {
            const status = statusLabelMap[step.status];
            const details = formatStepDetails(step.details);
            const duration = formatDuration(step.durationMs);
            return (
              <li
                className="rounded-2xl border border-default-200/60 bg-content1/70 px-4 py-3"
                key={step.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotClass[step.status]}`} />
                    <p className="font-semibold text-foreground text-sm">{step.label}</p>
                  </div>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={getStatusColor(step.status)}
                    className="font-semibold text-xs"
                  >
                    {status}
                  </Chip>
                </div>
                {(details || duration) && (
                  <p className="mt-2 text-foreground-500 text-xs">
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
