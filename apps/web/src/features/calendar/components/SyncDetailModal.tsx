import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { CalendarSyncLog } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SyncDetailModalProps {
  isOpen: boolean;
  log: CalendarSyncLog | null;
  onClose: () => void;
}

export function SyncDetailModal({ isOpen, log, onClose }: Readonly<SyncDetailModalProps>) {
  if (!log) return null;

  const hasChanges =
    (log.changeDetails?.inserted?.length ?? 0) > 0 ||
    (log.changeDetails?.updated?.length ?? 0) > 0 ||
    (log.changeDetails?.excluded?.length ?? 0) > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle de sincronización">
      <div className="space-y-6">
        {/* Status Banner */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-3 text-sm font-medium",
            (() => {
              if (log.status === "SUCCESS") return "bg-success/10 text-success";
              if (log.status === "ERROR") return "bg-error/10 text-error";
              return "bg-warning/10 text-warning";
            })(),
          )}
        >
          {(() => {
            if (log.status === "SUCCESS") return <CheckCircle size={18} />;
            if (log.status === "ERROR") return <XCircle size={18} />;
            return <AlertTriangle size={18} />;
          })()}
          <span>
            {(() => {
              if (log.status === "SUCCESS") return "Sincronización completada exitosamente";
              if (log.status === "ERROR") return "Error durante la sincronización";
              return "Sincronización en curso";
            })()}
          </span>
        </div>

        {log.errorMessage && (
          <div className="bg-error/5 text-error border-error/20 rounded-lg border p-3 text-sm">
            <p className="font-semibold">Error reportado:</p>
            <p className="mt-1 font-mono text-xs opacity-90">{log.errorMessage}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox color="text-success" label="Insertadas" value={log.inserted} />
          <StatBox color="text-info" label="Actualizadas" value={log.updated} />
          <StatBox color="text-base-content/60" label="Omitidas" value={log.skipped} />
          <StatBox color="text-warning" label="Excluidas" value={log.excluded} />
        </div>

        {/* Change Details */}
        {hasChanges && log.changeDetails && (
          <div className="space-y-4">
            <h3 className="text-base-content text-sm font-semibold">Detalle de cambios</h3>
            <div className="bg-base-200/50 max-h-60 space-y-4 overflow-y-auto rounded-xl p-4 text-xs">
              {log.changeDetails.inserted && log.changeDetails.inserted.length > 0 && (
                <div>
                  <h4 className="text-success mb-2 font-medium">
                    Nuevos eventos ({log.changeDetails.inserted.length})
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 opacity-80">
                    {log.changeDetails.inserted.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {log.changeDetails.updated && log.changeDetails.updated.length > 0 && (
                <div>
                  <h4 className="text-info mb-2 font-medium">
                    Actualizados ({log.changeDetails.updated.length})
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 opacity-80">
                    {log.changeDetails.updated.map((item, i) => {
                      const summary = typeof item === "string" ? item : item.summary;
                      return <li key={i}>{summary}</li>;
                    })}
                  </ul>
                </div>
              )}

              {log.changeDetails.excluded && log.changeDetails.excluded.length > 0 && (
                <div>
                  <h4 className="text-warning mb-2 font-medium">
                    Excluidos ({log.changeDetails.excluded.length})
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 opacity-80">
                    {log.changeDetails.excluded.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasChanges && log.status === "SUCCESS" && (
          <div className="text-base-content/50 py-4 text-center text-sm italic">
            No hubo cambios registrados en esta sincronización.
          </div>
        )}
      </div>
    </Modal>
  );
}

function StatBox({
  color,
  label,
  value,
}: Readonly<{ color?: string; label: string; value: number }>) {
  return (
    <div className="bg-base-100 border-base-200 flex flex-col items-center justify-center rounded-xl border p-3 text-center shadow-sm">
      <span className="text-base-content/60 mb-1 text-xs font-medium tracking-wider uppercase">
        {label}
      </span>
      <span className={cn("text-2xl font-bold", color)}>{numberFormatter.format(value)}</span>
    </div>
  );
}
