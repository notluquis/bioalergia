import { Accordion, Chip } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Calendar as CalendarIcon, ChevronDown, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionError } from "@/components/ui/SectionError";
import { ChangeDetailsViewer } from "@/features/calendar/components/ChangeDetailsViewer";
import { StatusBadge } from "@/features/calendar/components/StatusBadge";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { calendarQueries } from "@/features/calendar/queries";
import type { CalendarData, CalendarSyncLog } from "@/features/calendar/types";
import { cn } from "@/lib/utils";
export function CalendarSyncHistoryPage() {
  const [showConfig, setShowConfig] = useState(false);

  const {
    hasRunningSyncFromOtherSource,
    isErrorSyncLogs, // New
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
    if (log.status !== "RUNNING") {
      return false;
    }
    const started = dayjs(log.startedAt);
    // Match backend stale timeout: 15 minutes
    return started.isValid() && Date.now() - started.valueOf() < 15 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
        <div className="slide-in-from-top-2 fade-in animate-in rounded-xl border border-default-100 bg-background p-4 shadow-sm duration-200">
          <div className="mb-4 flex items-center gap-2 font-medium text-default-600 text-sm">
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
      <div className="min-h-100 overflow-hidden rounded-xl border border-default-100 bg-background shadow-sm">
        {renderSyncHistoryContent({
          isErrorSyncLogs,
          isLoading,
          refetch,
          syncError,
          syncLogs,
        })}
      </div>
    </section>
  );
}

function renderSyncHistoryContent(params: {
  isErrorSyncLogs: boolean;
  isLoading: boolean;
  refetch: () => void;
  syncError: null | string;
  syncLogs: CalendarSyncLog[];
}) {
  if (params.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (params.isErrorSyncLogs || params.syncError) {
    return (
      <SectionError
        className="border-none bg-transparent"
        error={params.syncError}
        message="El servidor tardó demasiado o hubo un problema de conexión."
        onRetry={params.refetch}
        title="No se pudo cargar el historial"
      />
    );
  }

  if (params.syncLogs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-default-400 text-sm">
        No hay registros de sincronización de calendario.
      </div>
    );
  }

  return (
    <Accordion className="w-full">
      {params.syncLogs.map((log, index) => (
        <SyncHistoryItem defaultExpanded={index === 0} key={log.id.toString()} log={log} />
      ))}
    </Accordion>
  );
}

function SyncHistoryItem({
  defaultExpanded,
  log,
}: {
  defaultExpanded: boolean;
  log: CalendarSyncLog;
}) {
  const duration = log.finishedAt ? dayjs(log.finishedAt).diff(dayjs(log.startedAt), "s") : null;
  const isEmptyChange =
    log.inserted === 0 && log.updated === 0 && log.excluded === 0 && log.skipped === 0;

  return (
    <Accordion.Item defaultExpanded={defaultExpanded} id={log.id.toString()}>
      <Accordion.Heading>
        <Accordion.Trigger className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-default-50/50 sm:flex-nowrap">
          <StatusBadge status={log.status} />
          <div className="min-w-24">
            <div className="font-medium text-sm">{dayjs(log.startedAt).format("DD/MM/YYYY")}</div>
            <div className="text-default-400 text-xs">
              {dayjs(log.startedAt).format("HH:mm:ss")}
            </div>
          </div>
          <div className="flex min-w-40 flex-1 flex-wrap items-center gap-2">
            <Chip size="sm" variant="secondary">
              <Chip.Label className="font-mono text-xs">{log.triggerSource}</Chip.Label>
            </Chip>
            {log.triggerLabel && (
              <span className="ml-2 text-default-500 text-xs" title={log.triggerLabel}>
                {log.triggerLabel.slice(0, 30)}
                {log.triggerLabel.length > 30 ? "..." : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {log.inserted > 0 && (
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
                +{log.inserted}
              </span>
            )}
            {log.updated > 0 && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                ~{log.updated}
              </span>
            )}
            {log.excluded > 0 && (
              <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">
                -{log.excluded}
              </span>
            )}
            {log.skipped > 0 && (
              <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                !{log.skipped}
              </span>
            )}
            {isEmptyChange && <span className="text-default-200">-</span>}
          </div>
          <div className="min-w-12 text-right text-default-600 text-sm">
            {duration === null ? "-" : `${duration}s`}
          </div>
          <Accordion.Indicator className="ml-auto text-default-300 sm:ml-0">
            <ChevronDown className="h-4 w-4" />
          </Accordion.Indicator>
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="border-default-100 border-t bg-default-50/30 px-6 py-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-semibold text-sm">Resumen de la Sincronización</h4>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-background p-3">
                <div>
                  <span className="block text-default-500 text-xs">ID</span>
                  <span className="font-mono text-sm">{log.id.toString()}</span>
                </div>
                <div>
                  <span className="block text-default-500 text-xs">Duración</span>
                  <span className="text-sm">
                    {duration !== null
                      ? `${duration} segundos`
                      : log.status === "RUNNING"
                        ? "En progreso..."
                        : "No disponible"}
                  </span>
                </div>
                <div>
                  <span className="block text-default-500 text-xs">Insertados</span>
                  <span className="font-bold text-lg text-success">{log.inserted}</span>
                </div>
                <div>
                  <span className="block text-default-500 text-xs">Actualizados</span>
                  <span className="font-bold text-lg text-primary">{log.updated}</span>
                </div>
                <div>
                  <span className="block text-default-500 text-xs">Excluidos</span>
                  <span className="font-bold text-danger text-lg">{log.excluded}</span>
                </div>
                <div>
                  <span className="block text-default-500 text-xs">Omitidos</span>
                  <span className="font-bold text-lg text-warning">{log.skipped}</span>
                </div>
              </div>
              {log.errorMessage && (
                <div className="mt-4">
                  <span className="mb-1 block font-bold text-danger text-xs">Mensaje de Error</span>
                  <div className="max-h-32 overflow-auto rounded-lg bg-danger/10 p-2 font-mono text-danger text-xs">
                    {log.errorMessage}
                  </div>
                </div>
              )}
            </div>
            <div>
              <ChangeDetailsViewer data={log.changeDetails} />
            </div>
          </div>
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function renderCalendarsList(calendars: CalendarData[]) {
  if (calendars.length === 0) {
    return (
      <div className="p-4 text-center text-default-400 text-sm">No hay calendarios conectados</div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {calendars.map((cal: CalendarData) => (
        <div
          className="flex items-center gap-3 rounded-lg border border-default-100 bg-default-50/50 p-3"
          key={cal.id}
        >
          <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium text-sm">{cal.name}</span>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-default-400 text-xs">
                {cal.eventCount.toLocaleString()} eventos
              </p>
              <span className="shrink-0 truncate font-mono text-[10px] text-default-200">
                {cal.googleId.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
