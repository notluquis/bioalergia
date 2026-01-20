import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { ChangeDetailsViewer } from "@/features/calendar/components/ChangeDetailsViewer";
import { StatusBadge } from "@/features/calendar/components/StatusBadge";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { calendarQueries } from "@/features/calendar/queries";
import type { CalendarData } from "@/features/calendar/types";
import { cn } from "@/lib/utils";

export default function CalendarSyncHistoryPage() {
  const [expandedId, setExpandedId] = useState<null | number>(null);
  const [showConfig, setShowConfig] = useState(false);

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

  // Fetch calendars
  const { data: calendars } = useSuspenseQuery(calendarQueries.list());

  const isLoading = isLoadingSyncLogs;

  const hasRunningSyncInHistory = syncLogs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    // Match backend stale timeout: 15 minutes
    return started.isValid() && Date.now() - started.valueOf() < 15 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;

  const toggleExpanded = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Historial de Sincronización</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowConfig(!showConfig)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Settings2 size={16} />
            {showConfig ? "Ocultar Configuración" : "Ver Calendarios"}
          </Button>
          <Button
            disabled={isLoading || isSyncing}
            onClick={() => refetch()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button disabled={isSyncing || isLoading} onClick={syncNow} size="sm" type="button">
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="bg-base-100 border-base-200 rounded-xl border p-4 shadow-sm animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-base-content/70">
            <CalendarIcon size={16} />
            Calendarios Conectados
          </div>
          {renderCalendarsList(calendars)}
        </div>
      )}

      {/* Sync Status Panel */}
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
              {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: row rendering logic */}
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

function renderCalendarsList(calendars: CalendarData[]) {
  if (calendars.length === 0) {
    return (
      <div className="text-base-content/50 p-4 text-center text-sm">
        No hay calendarios conectados
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {calendars.map((cal: CalendarData) => (
        <div
          className="bg-base-200/50 border-base-200 flex items-center gap-3 rounded-lg border p-3"
          key={cal.id}
        >
          <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium text-sm">{cal.name}</span>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base-content/50 truncate text-xs">
                {cal.eventCount.toLocaleString()} eventos
              </p>
              <span className="text-base-content/30 shrink-0 truncate font-mono text-[10px]">
                {cal.googleId.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
