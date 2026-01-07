import Modal from "@/components/ui/Modal";
import type { CalendarSyncLog } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";

interface SyncDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: CalendarSyncLog | null;
}

export function SyncDetailModal({ isOpen, onClose, log }: SyncDetailModalProps) {
  if (!log) return null;

  // Simulated sync steps from CalendarSyncStep type
  const syncSteps = [
    { id: "fetch", label: "Consultando Google Calendar", status: "completed" as const },
    { id: "upsert", label: "Actualizando base de datos", status: "completed" as const },
    { id: "exclude", label: "Eliminando eventos excluidos", status: "completed" as const },
    { id: "snapshot", label: "Guardando snapshot", status: "completed" as const },
  ];

  const statusColors = {
    pending: "bg-base-200 text-base-content/70",
    in_progress: "bg-primary/15 text-primary",
    completed: "bg-secondary/20 text-secondary",
    error: "bg-error/20 text-error",
  };

  const dotColors = {
    pending: "bg-base-300",
    in_progress: "bg-primary animate-pulse",
    completed: "bg-secondary",
    error: "bg-error",
  };

  const statusLabels = {
    pending: "Pendiente",
    in_progress: "En progreso",
    completed: "Listo",
    error: "Error",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle de sincronización">
      <div className="space-y-4">
        {/* Sync summary */}
        <div className="bg-base-100/70 border-base-300/60 rounded-2xl border p-4">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-base-content/70 font-medium">Insertadas:</span>
              <span className="text-base-content ml-2 font-semibold">{numberFormatter.format(log.inserted)}</span>
            </div>
            <div>
              <span className="text-base-content/70 font-medium">Actualizadas:</span>
              <span className="text-base-content ml-2 font-semibold">{numberFormatter.format(log.updated)}</span>
            </div>
          </div>
        </div>

        {/* Sync steps */}
        <div className="space-y-3">
          <h3 className="text-base-content text-sm font-semibold">Pasos de sincronización</h3>
          <ul className="space-y-3">
            {syncSteps.map((step) => (
              <li key={step.id} className="border-base-300/60 bg-base-100/70 rounded-2xl border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotColors[step.status]}`} />
                    <p className="text-base-content text-sm font-semibold">{step.label}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[step.status]}`}>
                    {statusLabels[step.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
