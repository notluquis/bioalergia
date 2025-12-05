import { useState } from "react";
import { Calendar, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function CalendarSettingsPage() {
  const [syncing, setSyncing] = useState(false);

  // Fetch sync status (mock for now, or real endpoint if available)
  const { data: syncStatus } = useQuery({
    queryKey: ["calendar-sync-status"],
    queryFn: async () => {
      // In a real app, fetch from /api/calendar/status
      return {
        lastSync: new Date().toISOString(),
        status: "SUCCESS", // SUCCESS, ERROR, PENDING
        calendars: ["primary", "secondary"],
      };
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      // Simulate sync delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Call actual endpoint: await apiClient.post("/api/calendar/sync", {});
      setSyncing(false);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-base-content">Configuración de Calendario</h1>
        <p className="text-sm text-base-content/60">Gestiona la sincronización con Google Calendar.</p>
      </div>

      <div className="surface-elevated rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Sincronización Automática</h2>
              <p className="text-sm text-base-content/60">Los eventos se sincronizan cada 15 minutos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("badge gap-1", syncStatus?.status === "SUCCESS" ? "badge-success" : "badge-error")}>
              {syncStatus?.status === "SUCCESS" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {syncStatus?.status === "SUCCESS" ? "Activo" : "Error"}
            </span>
          </div>
        </div>

        <div className="divider" />

        <div className="space-y-4">
          <h3 className="font-medium text-base-content/80">Calendarios Conectados</h3>
          <div className="grid gap-3">
            {syncStatus?.calendars.map((cal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg border border-base-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-medium">{cal}</span>
                </div>
                <span className="text-xs text-base-content/50 font-mono">ID: {cal}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => syncMutation.mutate()} disabled={syncing} className="gap-2">
            <RefreshCw size={16} className={cn(syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar Ahora"}
          </Button>
        </div>
      </div>
    </div>
  );
}
