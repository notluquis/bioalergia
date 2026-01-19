import dayjs from "dayjs";
import { CheckCircle, ChevronDown, ChevronRight, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { cn } from "@/lib/utils";

interface ChangeDetail {
  action?: string;
  eventId?: string;
  fields?: string[];
  summary?: string;
}

const ChangeDetailsViewer = ({ data }: { data: unknown }) => {
  if (!data) return null;

  const details = data as ChangeDetail[];
  if (!Array.isArray(details) || details.length === 0) {
    return <p className="text-base-content/50 text-sm italic">No hay cambios detallados.</p>;
  }

  // Group by action (safe - action is a controlled string from data)
  const grouped: Record<string, ChangeDetail[]> = {};
  for (const item of details) {
    const action = item.action ?? "unknown";
    // eslint-disable-next-line security/detect-object-injection
    grouped[action] ??= [];
    // eslint-disable-next-line security/detect-object-injection
    grouped[action].push(item);
  }

  const actionLabels: Record<string, { color: string; label: string }> = {
    created: { color: "text-success", label: "Insertados" },
    deleted: { color: "text-error", label: "Eliminados" },
    skipped: { color: "text-warning", label: "Omitidos" },
    unknown: { color: "text-base-content/70", label: "Otros" },
    updated: { color: "text-info", label: "Modificados" },
  };

  return (
    <details className="group bg-base-100/50 border-base-200 open:bg-base-100 overflow-hidden rounded-lg border">
      <summary className="hover:bg-base-200 flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium transition-colors select-none">
        <span>Ver Detalle de Cambios ({details.length})</span>
        <ChevronDown className="h-3 w-3 opacity-50 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-base-200 space-y-3 border-t p-3">
        {Object.entries(grouped).map(([action, items]) => {
          // eslint-disable-next-line security/detect-object-injection
          const lookup = actionLabels[action];
          const label = lookup?.label ?? "Otros";
          const color = lookup?.color ?? "text-base-content/70";
          return (
            <div key={action}>
              <h5 className={cn("mb-1.5 text-xs font-semibold tracking-wide uppercase", color)}>
                {label} ({items.length})
              </h5>
              <div className="bg-base-200/50 max-h-40 space-y-1 overflow-y-auto rounded-lg p-2">
                {items.slice(0, 50).map((item, idx) => (
                  <div
                    className="border-base-300 flex items-start gap-2 border-b pb-1 text-xs last:border-0"
                    key={idx}
                  >
                    <span className="text-base-content/70 flex-1 truncate" title={item.summary}>
                      {item.summary ?? item.eventId ?? "Sin título"}
                    </span>
                    {item.fields && item.fields.length > 0 && (
                      <span className="text-base-content/50 shrink-0 font-mono">
                        [{item.fields.join(", ")}]
                      </span>
                    )}
                  </div>
                ))}
                {items.length > 50 && (
                  <p className="text-base-content/50 pt-1 text-center text-xs">
                    ...y {items.length - 50} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
};

export default function CalendarSyncHistoryPage() {
  const [expandedId, setExpandedId] = useState<null | number>(null);

  const {
    hasRunningSyncFromOtherSource,
    isLoadingSyncLogs,
    lastSyncInfo,
    refetchSyncLogs: refetch,
    syncDurationMs,
    syncError,
    syncing,
    syncLogs,
    syncNow,
    syncProgress,
  } = useCalendarEvents();

  const isLoading = isLoadingSyncLogs;

  const hasRunningSyncInHistory = syncLogs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    // Match backend stale timeout: 5 minutes
    return started.isValid() && Date.now() - started.valueOf() < 5 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;

  const toggleExpanded = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = status.toUpperCase();
    if (s === "SUCCESS") {
      return (
        <span className="badge badge-success gap-1 text-xs font-semibold">
          <CheckCircle className="h-3 w-3" /> Exitoso
        </span>
      );
    }
    if (s === "ERROR" || s === "FAILED") {
      return (
        <span className="badge badge-error gap-1 text-xs font-semibold">
          <XCircle className="h-3 w-3" /> Error
        </span>
      );
    }
    return (
      <span className="badge badge-warning gap-1 text-xs font-semibold">
        <Loader2 className="h-3 w-3 animate-spin" /> {status}
      </span>
    );
  };

  return (
    <section className="space-y-6">
      {/* Sync Actions Card */}
      <div className="bg-base-100 border-base-200 flex flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base-content/70 text-sm font-medium">
            {syncLogs.length} sincronizaciones registradas
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isLoading || isSyncing}
            onClick={() => refetch()}
            size="sm"
            variant="ghost"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button disabled={isSyncing || isLoading} onClick={syncNow} size="sm">
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </div>

      {/* Sync Progress Live Status */}
      <SyncProgressPanel
        lastSyncInfo={lastSyncInfo ?? undefined}
        showLastSyncInfo
        syncDurationMs={syncDurationMs}
        syncError={syncError}
        syncing={syncing}
        syncProgress={syncProgress}
      />

      {/* Sync History Card */}
      <div className="bg-base-100 border-base-200 min-h-100 overflow-hidden rounded-xl border shadow-sm">
        {/* Content */}
        {(() => {
          if (isLoading) {
            return (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            );
          }

          if (syncLogs.length === 0) {
            return (
              <div className="text-base-content/50 flex h-64 items-center justify-center text-sm">
                No hay registros de sincronización de calendario.
              </div>
            );
          }

          return (
            <div className="divide-base-200 divide-y">
              {syncLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const duration = log.endedAt
                  ? dayjs(log.endedAt).diff(dayjs(log.startedAt), "s")
                  : null;

                return (
                  <div className="bg-base-100" key={log.id.toString()}>
                    {/* Row Header */}
                    <button
                      className="hover:bg-base-200/50 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors"
                      onClick={() => {
                        toggleExpanded(log.id);
                      }}
                      type="button"
                    >
                      {/* Expand Icon */}
                      <span className="text-base-content/40">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>

                      {/* Status */}
                      <StatusBadge status={log.status} />

                      {/* Date */}
                      <div className="min-w-24">
                        <div className="text-sm font-medium">
                          {dayjs(log.startedAt).format("DD/MM/YYYY")}
                        </div>
                        <div className="text-base-content/50 text-xs">
                          {dayjs(log.startedAt).format("HH:mm:ss")}
                        </div>
                      </div>

                      {/* Source */}
                      <div className="flex-1">
                        <span className="badge badge-ghost font-mono text-xs">
                          {log.triggerSource}
                        </span>
                        {log.triggerLabel && (
                          <span
                            className="text-base-content/60 ml-2 text-xs"
                            title={log.triggerLabel}
                          >
                            {log.triggerLabel.slice(0, 30)}
                            {log.triggerLabel.length > 30 ? "..." : ""}
                          </span>
                        )}
                      </div>

                      {/* Metrics */}
                      <div className="flex gap-2 text-xs">
                        <span
                          className="bg-success/10 text-success rounded px-1.5 py-0.5"
                          title="Insertados"
                        >
                          +{log.inserted}
                        </span>
                        <span
                          className="bg-info/10 text-info rounded px-1.5 py-0.5"
                          title="Actualizados"
                        >
                          ~{log.updated}
                        </span>
                        <span
                          className="bg-warning/10 text-warning rounded px-1.5 py-0.5"
                          title="Omitidos"
                        >
                          -{log.skipped}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="text-base-content/70 min-w-12 text-right text-sm">
                        {duration === null ? "-" : `${duration}s`}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="bg-base-200/30 border-base-200 border-t px-6 py-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Stats Summary */}
                          <div>
                            <h4 className="mb-3 text-sm font-semibold">
                              Resumen de la Sincronización
                            </h4>
                            <div className="bg-base-100 grid grid-cols-2 gap-3 rounded-lg p-3">
                              <div>
                                <span className="text-base-content/60 block text-xs">ID</span>
                                <span className="font-mono text-sm">{log.id.toString()}</span>
                              </div>
                              <div>
                                <span className="text-base-content/60 block text-xs">Duración</span>
                                <span className="text-sm">
                                  {duration === null ? "En progreso..." : `${duration} segundos`}
                                </span>
                              </div>
                              <div>
                                <span className="text-base-content/60 block text-xs">
                                  Insertados
                                </span>
                                <span className="text-success text-lg font-bold">
                                  {log.inserted}
                                </span>
                              </div>
                              <div>
                                <span className="text-base-content/60 block text-xs">
                                  Actualizados
                                </span>
                                <span className="text-info text-lg font-bold">{log.updated}</span>
                              </div>
                              <div>
                                <span className="text-base-content/60 block text-xs">Omitidos</span>
                                <span className="text-warning text-lg font-bold">
                                  {log.skipped}
                                </span>
                              </div>
                              <div>
                                <span className="text-base-content/60 block text-xs">
                                  Excluidos
                                </span>
                                <span className="text-base-content/70 text-lg font-bold">
                                  {log.excluded}
                                </span>
                              </div>
                            </div>

                            {/* Error Message */}
                            {log.errorMessage && (
                              <div className="mt-4">
                                <span className="text-error mb-1 block text-xs font-bold">
                                  Mensaje de Error
                                </span>
                                <div className="bg-error/10 text-error max-h-32 overflow-auto rounded-lg p-2 font-mono text-xs">
                                  {log.errorMessage}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Change Details */}
                          <div>
                            <h4 className="mb-3 text-sm font-semibold">Detalle de Cambios</h4>
                            <ChangeDetailsViewer data={log.changeDetails} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </section>
  );
}
