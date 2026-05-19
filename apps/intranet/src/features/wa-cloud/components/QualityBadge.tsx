import { Chip, Popover } from "@heroui/react";
import { AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePhoneQualitySummary } from "../hooks/useWaCloud";

// Header badge that summarises Meta phone quality + unacknowledged
// account events. Click → goes to the alerts page filtered by phone.
//
// Severity priority: any RED → red; YELLOW or critical/warning unack → yellow;
// otherwise GREEN. Hidden until we have data so the header doesn't flash.
export function QualityBadge({ phoneNumberId }: { phoneNumberId: number | undefined }) {
  const q = usePhoneQualitySummary(phoneNumberId);
  if (!phoneNumberId || !q.data) return null;
  const { qualityRating, criticalUnacknowledged, warningUnacknowledged } = q.data;

  const isRed = qualityRating === "RED" || criticalUnacknowledged > 0;
  const isYellow = !isRed && (qualityRating === "YELLOW" || warningUnacknowledged > 0);
  const color: "danger" | "warning" | "success" = isRed
    ? "danger"
    : isYellow
      ? "warning"
      : "success";
  const Icon = isRed ? ShieldOff : isYellow ? AlertTriangle : ShieldCheck;
  const label = isRed
    ? "Calidad: RED"
    : isYellow
      ? `Calidad: ${qualityRating ?? "OK"} · ${warningUnacknowledged} alertas`
      : "Calidad OK";

  return (
    <Popover>
      <Popover.Trigger>
        <button type="button" aria-label={label} className="cursor-pointer">
          <Chip size="sm" color={color} variant="soft">
            <Chip.Label>
              <span className="inline-flex items-center gap-1">
                <Icon size={12} />
                {label}
              </span>
            </Chip.Label>
          </Chip>
        </button>
      </Popover.Trigger>
      <Popover.Content className="w-72 rounded-xl border border-default-200 bg-content1 p-3 shadow-md">
        <Popover.Dialog className="space-y-2 p-0">
          <p className="font-semibold text-sm">Estado de calidad del número</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Quality rating" value={qualityRating ?? "—"} />
            <Stat label="Críticas" value={String(criticalUnacknowledged)} />
            <Stat label="Warnings" value={String(warningUnacknowledged)} />
            <Stat
              label="Último evento"
              value={q.data.lastEventAt ? new Date(q.data.lastEventAt).toLocaleString() : "—"}
            />
          </div>
          {isRed && (
            <p className="rounded-md bg-danger-50 p-2 text-danger text-xs">
              Pacientes han reportado este número. Pausa campañas y revisa contenido antes de
              reanudar para evitar suspensión.
            </p>
          )}
          <Link
            to="/wa-cloud"
            search={{ tab: "alertas" }}
            className="block rounded-md bg-content2 px-2 py-1.5 text-center font-medium text-xs hover:bg-content3"
          >
            Ver alertas →
          </Link>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-content2 p-1.5">
      <p className="text-xs text-default-500 uppercase">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
