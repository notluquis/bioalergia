import { useEffect, useMemo, useState } from "react";
import Button from "./Button";

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

const INDICATOR_COLORS: Record<IndicatorLevel, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-rose-400",
  starting: "bg-blue-400 animate-pulse",
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
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let retryCount = 0;
    let delay = 120000; // 2 minutes

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
        if (!hasConnectedOnce) {
          setHasConnectedOnce(true);
          retryCount = 0;
          delay = 120000;
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
          setState({ level: "online", fetchedAt, message: STATUS_COPY.online.description, details, retryCount: 0 });
          retryCount = 0;
          delay = 120000;
        } else if (payload.status === "degraded") {
          setState({ level: "degraded", fetchedAt, message: STATUS_COPY.degraded.description, details, retryCount: 0 });
          retryCount = 0;
          delay = 120000;
        } else {
          setState({ level: "offline", fetchedAt, message: STATUS_COPY.offline.description, details, retryCount: 0 });
          retryCount++;
          delay = Math.min(300000, 120000 * Math.pow(2, retryCount)); // up to 5 min
        }
      } catch (error) {
        if (cancelled) return;
        const fetchedAt = new Date();
        setState((prevState) => {
          const newRetryCount = prevState.retryCount + 1;
          const isStarting = !hasConnectedOnce && newRetryCount < 4;
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
        retryCount++;
        delay = Math.min(300000, 120000 * Math.pow(2, retryCount));
        if (!hasConnectedOnce && retryCount > 2) setOpen(true);
      } finally {
        window.clearTimeout(requestTimeoutId);
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(fetchHealthWithBackoff, delay);
      }
    }

    // Initial delay before first health check
    timeoutId = window.setTimeout(fetchHealthWithBackoff, 2000);

    // Listen for global API success events to reset health check
    function resetHealthCheck() {
      if (timeoutId) window.clearTimeout(timeoutId);
      retryCount = 0;
      delay = 120000;
      timeoutId = window.setTimeout(fetchHealthWithBackoff, 2000);
    }
    window.addEventListener("api-success", resetHealthCheck);
    window.addEventListener("beforeunload", resetHealthCheck);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("api-success", resetHealthCheck);
      window.removeEventListener("beforeunload", resetHealthCheck);
    };
  }, [hasConnectedOnce]);

  // Auto-cerrar después de un tiempo si no está online
  useEffect(() => {
    if (!open || state.level === "online") return;
    const timer = window.setTimeout(() => setOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [open, state.level]);

  const statusCopy = useMemo(() => STATUS_COPY[state.level], [state.level]);

  return (
    <div className="relative dropdown dropdown-end">
      <Button
        type="button"
        size="xs"
        variant="secondary"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium text-slate-600 transition bg-base-100"
        aria-pressed={open}
        aria-label={`Estado de la conexión: ${statusCopy.label}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full shadow-inner transition ${INDICATOR_COLORS[state.level]}`} />
        <span className="hidden sm:inline">{statusCopy.label}</span>
      </Button>

      {open && (
        <div tabIndex={0} className="dropdown-content mt-2 w-72">
          <div className="space-y-3 rounded-2xl p-4 shadow-xl border border-white/20 bg-base-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{statusCopy.label}</p>
                <p className="text-xs text-slate-500/90">{state.message}</p>
              </div>
              <span
                className={`h-3 w-3 rounded-full ${INDICATOR_COLORS[state.level]} shadow-inner`}
                aria-hidden="true"
              />
            </div>
            {state.details.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-500">
                {state.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            )}
            {state.level === "starting" && (
              <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                💡 El servidor puede tardar 10-20 segundos en inicializar.
              </div>
            )}
            <div className="flex justify-between text-xs uppercase tracking-wide text-slate-400">
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
