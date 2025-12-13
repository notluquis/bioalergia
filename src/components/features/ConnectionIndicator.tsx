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
  const delayRef = useRef<number | null>(120000);
  const timeoutIdRef = useRef<number | null>(null);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const BASE_DELAY_MS = 120000;
    const MAX_DELAY_MS = 300000;

    const schedule = (delay: number | null) => {
      if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
      if (delay == null) {
        timeoutIdRef.current = null;
        delayRef.current = null;
        return;
      }
      delayRef.current = delay;
      timeoutIdRef.current = window.setTimeout(fetchHealthWithBackoff, delay);
    };

    async function fetchHealthWithBackoff() {
      const controller = new AbortController();
      const requestTimeoutId = window.setTimeout(() => controller.abort(), 5000);
      let nextDelay: number | null = BASE_DELAY_MS;
      try {
        const res = await fetch("/api/health", {
          credentials: "include",
          signal: controller.signal,
        });
        const fetchedAt = new Date();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as HealthResponse;
        if (cancelled) return;

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
          hasConnectedRef.current = true;
          nextDelay = null; // no polling while healthy
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
          hasConnectedRef.current = true;
          nextDelay = BASE_DELAY_MS;
        } else {
          if (!cancelled)
            setState({ level: "offline", fetchedAt, message: STATUS_COPY.offline.description, details, retryCount: 0 });
          retryCountRef.current++;
          nextDelay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryCountRef.current));
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
        nextDelay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryCountRef.current));
        if (!hasConnectedRef.current && retryCountRef.current > 2 && !cancelled) setOpen(true);
      } finally {
        window.clearTimeout(requestTimeoutId);
      }
      if (!cancelled) {
        schedule(nextDelay);
      }
    }

    // Initial delay before first health check
    schedule(2000);

    // Recheck when tab becomes visible and we're not online
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && state.level !== "online") {
        schedule(500);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", () => {
      if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
    });

    return () => {
      cancelled = true;
      if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.level]);

  // Auto-cerrar después de un tiempo si no está online
  useEffect(() => {
    if (!open || state.level === "online") return;
    const timer = window.setTimeout(() => setOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [open, state.level]);

  const statusCopy = useMemo(() => STATUS_COPY[state.level], [state.level]);
  const styles = INDICATOR_STYLES[state.level];

  return (
    <div className="dropdown dropdown-end relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors",
          "focus-visible:ring-primary/70 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          styles.chip
        )}
        aria-pressed={open}
        aria-label={`Estado de la conexión: ${statusCopy.label}`}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full shadow-inner transition", styles.dot)} />
        <span>{statusCopy.label}</span>
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
