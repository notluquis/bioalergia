import { useState } from "react";
import { Calendar, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/apiClient";

interface CalendarData {
  id: number;
  googleId: string;
  name: string;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncLog {
  id: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  inserted: number;
  updated: number;
  excluded: number;
}

export default function CalendarSettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch calendars
  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      return await apiClient.get<{ calendars: CalendarData[] }>("/api/calendar/calendars");
    },
  });

  // Fetch sync logs
  const { data: syncLogsData } = useQuery({
    queryKey: ["calendar-sync-logs"],
    queryFn: async () => {
      return await apiClient.get<{ logs: SyncLog[] }>("/api/calendar/events/sync/logs");
    },
  });

  const lastSync = syncLogsData?.logs?.[0];
  const syncStatus = lastSync?.status === "SUCCESS" ? "SUCCESS" : lastSync?.status === "RUNNING" ? "RUNNING" : "ERROR";

  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      try {
        await apiClient.post("/api/calendar/events/sync", {});
        await queryClient.invalidateQueries({ queryKey: ["calendar-sync-logs"] });
        await queryClient.invalidateQueries({ queryKey: ["calendars"] });
      } finally {
        setSyncing(false);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base-content text-2xl font-bold">Configuración de Calendario</h1>
        <p className="text-base-content/60 text-sm">Gestiona la sincronización con Google Calendar.</p>
      </div>

      <div className="surface-elevated space-y-6 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Sincronización Automática</h2>
              <p className="text-base-content/60 text-sm">Los eventos se sincronizan cada 15 minutos.</p>
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
                "badge gap-1",
                syncStatus === "SUCCESS" ? "badge-success" : syncStatus === "RUNNING" ? "badge-warning" : "badge-error"
              )}
            >
              {syncStatus === "SUCCESS" ? (
                <CheckCircle2 size={12} />
              ) : syncStatus === "RUNNING" ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <AlertCircle size={12} />
              )}
              {syncStatus === "SUCCESS" ? "Activo" : syncStatus === "RUNNING" ? "Sincronizando" : "Error"}
            </span>
          </div>
        </div>

        <div className="divider" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base-content/80 font-medium">Calendarios Conectados</h3>
            {!calendarsLoading && (
              <span className="text-base-content/50 text-xs">{calendarsData?.calendars.length || 0} calendario(s)</span>
            )}
          </div>

          {calendarsLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw size={24} className="text-base-content/30 animate-spin" />
            </div>
          ) : calendarsData?.calendars && calendarsData.calendars.length > 0 ? (
            <div className="grid gap-3">
              {calendarsData.calendars.map((cal: CalendarData) => (
                <div
                  key={cal.id}
                  className="bg-base-200/50 border-base-200 flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <span className="font-medium">{cal.name}</span>
                      <p className="text-base-content/50 mt-0.5 text-xs">{cal.eventCount.toLocaleString()} evento(s)</p>
                    </div>
                  </div>
                  <span className="text-base-content/50 font-mono text-xs">{cal.googleId}</span>
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
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncing || syncStatus === "RUNNING"}
            className="gap-2"
          >
            <RefreshCw size={16} className={cn((syncing || syncStatus === "RUNNING") && "animate-spin")} />
            {syncing || syncStatus === "RUNNING" ? "Sincronizando..." : "Sincronizar Ahora"}
          </Button>
        </div>
      </div>
    </div>
  );
}
