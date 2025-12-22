import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchSystemHealth } from "@/features/system/api";

type IndicatorLevel = "online" | "degraded" | "offline" | "starting";

const STATUS_COPY: Record<IndicatorLevel, { label: string; description: string }> = {
  online: {
    label: "Conectado",
    description: "API y base de datos respondiendo con normalidad.",
  },
  degraded: {
    label: "Conectado con alertas",
    description: "Seguimos comunicándonos con el servidor pero detectamos incidencias.",
  },
  offline: {
    label: "Sin conexión",
    description: "No pudimos contactar al servidor. Verifica el servicio.",
  },
  starting: {
    label: "Servidor iniciando...",
    description: "El servidor está arrancando. Esto puede tomar unos momentos.",
  },
};

const INDICATOR_STYLES: Record<IndicatorLevel, { dot: string; chip: string; panel: string }> = {
  online: {
    dot: "bg-success shadow-[0_0_0_3px] shadow-success/25",
    chip: "bg-success/15 text-success border border-success/20 shadow-sm",
    panel: "border-success/20",
  },
  degraded: {
    dot: "bg-warning shadow-[0_0_0_3px] shadow-warning/30",
    chip: "bg-warning/15 text-warning-content border border-warning/20 shadow-sm",
    panel: "border-warning/20",
  },
  offline: {
    dot: "bg-error shadow-[0_0_0_3px] shadow-error/30",
    chip: "bg-error/15 text-error border border-error/20 shadow-sm",
    panel: "border-error/20",
  },
  starting: {
    dot: "bg-info animate-pulse shadow-[0_0_0_3px] shadow-info/30",
    chip: "bg-info/15 text-info border border-info/20 shadow-sm",
    panel: "border-info/20",
  },
};

export function ConnectionIndicator() {
  const [open, setOpen] = useState(false);

  const {
    data: health,
    isLoading,
    isError,
    error,
    isRefetching,
  } = useQuery({
    queryKey: ["system-health"],
    queryFn: ({ signal }) => fetchSystemHealth(signal),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000; // Poll while loading or error
      if (data.status === "ok") return false; // Stop polling if healthy
      return 120000; // Poll slow if degraded
    },
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const state = useMemo(() => {
    let level: IndicatorLevel = "starting";
    let message = STATUS_COPY.starting.description;
    let details: string[] = ["Verificando estado..."];
    let fetchedAt: Date | null = null;

    if (isLoading && !health) {
      level = "starting";
    } else if (isError) {
      level = "offline";
      message = STATUS_COPY.offline.description;
      details = [error instanceof Error ? error.message : "Error de conexión"];
      fetchedAt = new Date();
    } else if (health) {
      fetchedAt = new Date(health.timestamp || Date.now());
      details = [];

      // Parse details from health check
      if (health.checks?.db) {
        const dbCheck = health.checks.db;
        if (dbCheck.status === "error") {
          details.push(dbCheck.message ?? "No se pudo contactar la base de datos");
        } else if (typeof dbCheck.latency === "number") {
          details.push(`Base de datos OK · ${dbCheck.latency} ms`);
        } else {
          details.push("Base de datos OK");
        }
      }

      if (health.status === "ok") {
        level = "online";
        message = STATUS_COPY.online.description;
      } else if (health.status === "degraded") {
        level = "degraded";
        message = STATUS_COPY.degraded.description;
      } else {
        level = "offline";
        message = STATUS_COPY.offline.description;
      }
    }

    return { level, message, details, fetchedAt };
  }, [health, isLoading, isError, error]);

  const statusCopy = STATUS_COPY[state.level];
  const styles = INDICATOR_STYLES[state.level];

  return (
    <div className="dropdown dropdown-end relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors",
          "focus-visible:ring-primary/70 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          styles.chip,
          isRefetching && !isLoading && "opacity-70"
        )}
        aria-pressed={open}
        aria-label={`Estado de la conexión: ${statusCopy.label}`}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full shadow-inner transition", styles.dot)} />
        <span className="hidden md:inline">{statusCopy.label}</span>
      </button>

      {open && (
        <div tabIndex={0} className="dropdown-content mt-2 w-72">
          <div
            className={cn("bg-base-100/95 space-y-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md", styles.panel)}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base-content text-sm font-semibold">{statusCopy.label}</p>
                <p className="text-base-content/70 text-xs">{state.message}</p>
              </div>
              <span className={cn("h-3 w-3 rounded-full shadow-inner", styles.dot)} aria-hidden="true" />
            </div>
            {state.details.length > 0 && (
              <ul className="text-base-content/60 space-y-1 text-xs">
                {state.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            )}
            {state.level === "starting" && (
              <div className="bg-info/10 text-info rounded-lg p-2 text-xs">
                💡 El servidor puede tardar 10-20 segundos en inicializar.
              </div>
            )}
            <div className="text-base-content/50 flex justify-between text-xs tracking-wide uppercase">
              <span>Servicio API</span>
              <span>
                {state.fetchedAt
                  ? `Hace ${Math.max(0, Math.round((Date.now() - state.fetchedAt.getTime()) / 1000))} s`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionIndicator;
