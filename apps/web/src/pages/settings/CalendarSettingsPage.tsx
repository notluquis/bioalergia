import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle2, RefreshCw } from "lucide-react";

import Button from "@/components/ui/Button";
import { fetchCalendars } from "@/features/calendar/api";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarData } from "@/features/calendar/types";
import { cn } from "@/lib/utils";

export default function CalendarSettingsPage() {
  const { syncing, syncError, syncProgress, syncDurationMs, syncNow, syncLogs, hasRunningSyncFromOtherSource } =
    useCalendarEvents();

  // Fetch calendars
  const { data: calendars = [], isLoading: calendarsLoading } = useQuery({
    queryKey: ["calendars"],
    queryFn: fetchCalendars,
  });

  const lastSync = syncLogs?.[0];
  const syncStatus: "SUCCESS" | "ERROR" | "RUNNING" | undefined =
    lastSync?.status === "RUNNING"
      ? "RUNNING"
      : lastSync?.status === "SUCCESS"
        ? "SUCCESS"
        : lastSync?.status === "ERROR"
          ? "ERROR"
          : undefined;

  const isSyncing = syncing || hasRunningSyncFromOtherSource;

  return (
    <div className="space-y-6">
      <div className="surface-elevated space-y-6 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Sincronización automática</h2>
              <p className="text-base-content/60 text-sm">
                Webhooks activos para sincronización en tiempo real. Sincronización de respaldo cada 15 minutos.
              </p>
              {lastSync && (
                <p className="text-base-content/50 mt-1 text-xs">
                  Última sincronización:{" "}
                  {new Date(lastSync.startedAt).toLocaleString("es-CL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "badge h-auto gap-1 py-1 whitespace-nowrap",
                syncStatus === "SUCCESS"
                  ? "badge-success"
                  : syncStatus === "RUNNING"
                    ? "badge-warning"
                    : syncStatus === "ERROR"
                      ? "badge-error"
                      : "badge-ghost"
              )}
            >
              {syncStatus === "SUCCESS" ? (
                <CheckCircle2 size={12} />
              ) : syncStatus === "RUNNING" ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : syncStatus === "ERROR" ? (
                <AlertCircle size={12} />
              ) : (
                <RefreshCw size={12} />
              )}
              {syncStatus === "SUCCESS"
                ? "Activo"
                : syncStatus === "RUNNING"
                  ? "Sincronizando..."
                  : syncStatus === "ERROR"
                    ? "Error"
                    : "Sin datos"}
            </span>
          </div>
        </div>

        <div className="divider" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base-content/80 font-medium">Calendarios conectados</h3>
            {!calendarsLoading && (
              <span className="text-base-content/50 text-xs">{calendars.length || 0} calendario(s)</span>
            )}
          </div>

          {calendarsLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw size={24} className="text-base-content/30 animate-spin" />
            </div>
          ) : calendars.length > 0 ? (
            <div className="grid gap-3">
              {calendars.map((cal: CalendarData) => (
                <div
                  key={cal.id}
                  className="bg-base-200/50 border-base-200 flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{cal.name}</span>
                      <p className="text-base-content/50 mt-0.5 truncate text-xs">
                        {cal.eventCount.toLocaleString()} evento(s)
                      </p>
                    </div>
                  </div>
                  <span className="text-base-content/50 max-w-32 shrink-0 truncate font-mono text-xs sm:max-w-48">
                    {cal.googleId}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-base-content/50 p-8 text-center">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay calendarios conectados</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={syncNow} disabled={isSyncing} className="gap-2">
            <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </div>

      <SyncProgressPanel
        syncing={syncing}
        syncError={syncError}
        syncProgress={syncProgress}
        syncDurationMs={syncDurationMs}
      />
    </div>
  );
}
