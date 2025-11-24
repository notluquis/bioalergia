import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: {
    db: {
      status: "ok" | "error";
      latency: number | null;
      message?: string;
    };
  };
}

type IndicatorLevel = "online" | "degraded" | "offline" | "starting";

type IndicatorState = {
  level: IndicatorLevel;
  fetchedAt: Date | null;
  message: string;
  details: string[];
  retryCount: number;
};

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
    dot: "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-400/25",
    chip: "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-50 dark:border-emerald-700/60",
    panel: "border-emerald-200/80 dark:border-emerald-700/60",
  },
  degraded: {
    dot: "bg-amber-500 shadow-[0_0_0_3px] shadow-amber-400/30",
    chip: "bg-amber-50 text-amber-900 border border-amber-200/80 shadow-sm dark:bg-amber-900/40 dark:text-amber-50 dark:border-amber-700/60",
    panel: "border-amber-200/80 dark:border-amber-700/60",
  },
  offline: {
    dot: "bg-rose-500 shadow-[0_0_0_3px] shadow-rose-400/30",
    chip: "bg-rose-50 text-rose-900 border border-rose-200/80 shadow-sm dark:bg-rose-900/40 dark:text-rose-50 dark:border-rose-700/60",
    panel: "border-rose-200/80 dark:border-rose-700/60",
  },
  starting: {
    dot: "bg-blue-500 animate-pulse shadow-[0_0_0_3px] shadow-blue-400/30",
    chip: "bg-blue-50 text-blue-900 border border-blue-200/80 shadow-sm dark:bg-blue-900/40 dark:text-blue-50 dark:border-blue-700/60",
    panel: "border-blue-200/80 dark:border-blue-700/60",
  },
};

export function ConnectionIndicator() {
  const [state, setState] = useState<IndicatorState>({
    level: "starting",
    fetchedAt: null,
    message: STATUS_COPY.starting.description,
    details: ["Intentando conectar al servidor..."],
    retryCount: 0,
  });
  const [open, setOpen] = useState(false);

  // Use refs to persist retry state and connection status across effect reruns
  const retryCountRef = useRef(0);
  const delayRef = useRef(120000);
  const timeoutIdRef = useRef<number | null>(null);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHealthWithBackoff() {
      const controller = new AbortController();
      const requestTimeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch("/api/health", {
          credentials: "include",
          signal: controller.signal,
        });
        const fetchedAt = new Date();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as HealthResponse;
        if (cancelled) return;

        if (!hasConnectedRef.current) {
          hasConnectedRef.current = true;
          retryCountRef.current = 0;
          delayRef.current = 120000;
        }

        const details: string[] = [];
        if (payload.checks?.db) {
          const dbCheck = payload.checks.db;
          if (dbCheck.status === "error") {
            details.push(dbCheck.message ?? "No se pudo contactar la base de datos");
          } else if (typeof dbCheck.latency === "number") {
            details.push(`Base de datos OK · ${dbCheck.latency} ms`);
          } else {
            details.push("Base de datos OK");
          }
        }
        if (payload.status === "ok") {
          if (!cancelled)
            setState({ level: "online", fetchedAt, message: STATUS_COPY.online.description, details, retryCount: 0 });
          retryCountRef.current = 0;
          delayRef.current = 120000;
        } else if (payload.status === "degraded") {
          if (!cancelled)
            setState({
              level: "degraded",
              fetchedAt,
              message: STATUS_COPY.degraded.description,
              details,
              retryCount: 0,
            });
          retryCountRef.current = 0;
          delayRef.current = 120000;
        } else {
          if (!cancelled)
            setState({ level: "offline", fetchedAt, message: STATUS_COPY.offline.description, details, retryCount: 0 });
          retryCountRef.current++;
          delayRef.current = Math.min(300000, 120000 * Math.pow(2, retryCountRef.current));
        }
      } catch (error) {
        if (cancelled) return;
        const fetchedAt = new Date();
        setState((prevState) => {
          const newRetryCount = prevState.retryCount + 1;
          const isStarting = !hasConnectedRef.current && newRetryCount < 4;
          const detailMessage =
            error instanceof Error
              ? error.message === "The user aborted a request."
                ? "Conexión agotada (timeout)"
                : error.message
              : "Error desconocido";
          return {
            level: isStarting ? "starting" : "offline",
            fetchedAt,
            message: isStarting ? STATUS_COPY.starting.description : STATUS_COPY.offline.description,
            details: isStarting ? [`Intento ${newRetryCount}/4: ${detailMessage}`] : [detailMessage],
            retryCount: newRetryCount,
          };
        });
        retryCountRef.current++;
        delayRef.current = Math.min(300000, 120000 * Math.pow(2, retryCountRef.current));
        if (!hasConnectedRef.current && retryCountRef.current > 2 && !cancelled) setOpen(true);
      } finally {
        window.clearTimeout(requestTimeoutId);
      }
      if (!cancelled) {
        timeoutIdRef.current = window.setTimeout(fetchHealthWithBackoff, delayRef.current);
      }
    }

    // Initial delay before first health check
    timeoutIdRef.current = window.setTimeout(fetchHealthWithBackoff, 2000);

    // Listen for global API success events to reset health check
    function resetHealthCheck() {
      if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
      retryCountRef.current = 0;
      delayRef.current = 120000;
      timeoutIdRef.current = window.setTimeout(fetchHealthWithBackoff, 2000);
    }
    window.addEventListener("api-success", resetHealthCheck);
    window.addEventListener("beforeunload", resetHealthCheck);

    return () => {
      cancelled = true;
      if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
      window.removeEventListener("api-success", resetHealthCheck);
      window.removeEventListener("beforeunload", resetHealthCheck);
    };
  }, []);

  // Auto-cerrar después de un tiempo si no está online
  useEffect(() => {
    if (!open || state.level === "online") return;
    const timer = window.setTimeout(() => setOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [open, state.level]);

  const statusCopy = useMemo(() => STATUS_COPY[state.level], [state.level]);
  const styles = INDICATOR_STYLES[state.level];

  return (
    <div className="relative dropdown dropdown-end">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors backdrop-blur-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70",
          styles.chip
        )}
        aria-pressed={open}
        aria-label={`Estado de la conexión: ${statusCopy.label}`}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full shadow-inner transition", styles.dot)} />
        <span className="hidden sm:inline">{statusCopy.label}</span>
      </button>

      {open && (
        <div tabIndex={0} className="dropdown-content mt-2 w-72">
          <div
            className={cn("space-y-3 rounded-2xl border bg-base-100/95 p-4 shadow-xl backdrop-blur-md", styles.panel)}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-base-content">{statusCopy.label}</p>
                <p className="text-xs text-base-content/70">{state.message}</p>
              </div>
              <span className={cn("h-3 w-3 rounded-full shadow-inner", styles.dot)} aria-hidden="true" />
            </div>
            {state.details.length > 0 && (
              <ul className="space-y-1 text-xs text-base-content/60">
                {state.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            )}
            {state.level === "starting" && (
              <div className="rounded-lg bg-info/10 p-2 text-xs text-info">
                💡 El servidor puede tardar 10-20 segundos en inicializar.
              </div>
            )}
            <div className="flex justify-between text-xs uppercase tracking-wide text-base-content/50">
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
