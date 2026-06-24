import { Button } from "@heroui/react";
import { AlertTriangle, Clock, FileText } from "lucide-react";
import { useEffect, useState } from "react";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

// 24-hour customer-service window status, surfaced right above the composer.
// Renders nothing while the window is comfortably open (>2h) — the header chip
// already shows that — and only steps in when the operator needs to act:
// expiring soon (live countdown) or already closed (one-tap switch to template).
export function WindowBanner({
  windowOpen,
  windowExpiresAt,
  onUseTemplate,
}: {
  windowOpen: boolean;
  windowExpiresAt: Date | string | null | undefined;
  onUseTemplate: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!windowOpen) {
    return (
      <div className="flex items-center justify-between gap-3 border-warning-200 border-b bg-warning-50 px-4 py-2 text-warning-700 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="truncate">Ventana 24 h cerrada · solo puedes enviar plantillas</span>
        </span>
        <Button size="sm" variant="secondary" onPress={onUseTemplate} className="shrink-0">
          <FileText size={13} />
          Usar plantilla
        </Button>
      </div>
    );
  }

  const expiresMs = windowExpiresAt ? new Date(windowExpiresAt).getTime() : NaN;
  const left = Number.isFinite(expiresMs) ? expiresMs - now : Number.POSITIVE_INFINITY;
  if (left > TWO_HOURS_MS) return null;

  return (
    <div className="flex items-center gap-2 border-warning-200 border-b bg-warning-50/70 px-4 py-1.5 text-warning-700 text-xs">
      <Clock size={13} className="shrink-0" />
      <span>
        La ventana de respuesta cierra en <strong>{fmtCountdown(left)}</strong>. Después solo
        plantillas.
      </span>
    </div>
  );
}
