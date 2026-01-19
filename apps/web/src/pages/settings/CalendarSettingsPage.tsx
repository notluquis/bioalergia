import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { calendarQueries } from "@/features/calendar/queries";
import type { CalendarData } from "@/features/calendar/types";
import { cn } from "@/lib/utils";

export default function CalendarSettingsPage() {
  const {
    hasRunningSyncFromOtherSource,
    syncDurationMs,
    syncError,
    syncing,
    syncLogs,
    syncNow,
    syncProgress,
  } = useCalendarEvents();

  // Fetch calendars
  const { data: calendars } = useSuspenseQuery(calendarQueries.list());

  const lastSync = syncLogs[0];
  const getSyncStatus = () => {
    const status = lastSync?.status;
    return status === "RUNNING" || status === "SUCCESS" || status === "ERROR" ? status : undefined;
  };
  const syncStatus = getSyncStatus();

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
                Webhooks activos para sincronización en tiempo real. Sincronización de respaldo cada
                15 minutos.
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
          <div className="flex items-center gap-2">{renderSyncBadge(syncStatus)}</div>
        </div>

        <div className="divider" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base-content/80 font-medium">Calendarios conectados</h3>
          </div>
          {renderCalendarsList(calendars)}

          <div className="flex justify-end pt-4">
            <Button className="gap-2" disabled={isSyncing} onClick={syncNow}>
              <RefreshCw className={cn(isSyncing && "animate-spin")} size={16} />
              {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
        </div>
      </div>

      <SyncProgressPanel
        syncDurationMs={syncDurationMs}
        syncError={syncError}
        syncing={syncing}
        syncProgress={syncProgress}
      />
    </div>
  );
}

function renderCalendarsList(calendars: CalendarData[]) {
  if (calendars.length === 0) {
    return (
      <div className="text-base-content/50 p-8 text-center">
        <Calendar className="mx-auto mb-2 opacity-30" size={32} />
        <p className="text-sm">No hay calendarios conectados</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {calendars.map((cal: CalendarData) => (
        <div
          className="bg-base-200/50 border-base-200 flex items-center justify-between gap-4 rounded-lg border p-3"
          key={cal.id}
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
  );
}

function renderSyncBadge(status: "ERROR" | "RUNNING" | "SUCCESS" | undefined) {
  let badgeClass = "badge-ghost";
  let icon = <RefreshCw size={12} />;
  let text = "Sin datos";

  switch (status) {
    case "ERROR": {
      badgeClass = "badge-error";
      icon = <AlertCircle size={12} />;
      text = "Error";

      break;
    }
    case "RUNNING": {
      badgeClass = "badge-warning";
      icon = <span className="loading loading-spinner loading-xs"></span>;
      text = "Sincronizando...";

      break;
    }
    case "SUCCESS": {
      badgeClass = "badge-success";
      icon = <CheckCircle2 size={12} />;
      text = "Activo";

      break;
    }
    // No default
  }

  return (
    <span className={cn("badge h-auto gap-1 py-1 whitespace-nowrap", badgeClass)}>
      {icon}
      {text}
    </span>
  );
}
