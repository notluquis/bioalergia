import { Alert, Modal } from "@heroui/react";
import type { CalendarSyncLog } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SyncDetailModalProps {
  isOpen: boolean;
  log: CalendarSyncLog | null;
  onClose: () => void;
}

export function SyncDetailModal({ isOpen, log, onClose }: Readonly<SyncDetailModalProps>) {
  if (!log) {
    return null;
  }

  const hasChanges =
    (log.changeDetails?.inserted?.length ?? 0) > 0 ||
    (log.changeDetails?.updated?.length ?? 0) > 0 ||
    (log.changeDetails?.excluded?.length ?? 0) > 0;

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Detalle de sincronización</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <div className="space-y-6">
                {/* Status Banner */}
                <Alert
                  status={
                    log.status === "SUCCESS"
                      ? "success"
                      : log.status === "ERROR"
                        ? "danger"
                        : "warning"
                  }
                >
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {log.status === "SUCCESS"
                        ? "Sincronización completada exitosamente"
                        : log.status === "ERROR"
                          ? "Error durante la sincronización"
                          : "Sincronización en curso"}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>

                {log.errorMessage && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Error reportado:</Alert.Title>
                      <Alert.Description className="font-mono text-xs opacity-90">
                        {log.errorMessage}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatBox color="text-success" label="Insertadas" value={log.inserted} />
                  <StatBox color="text-info" label="Actualizadas" value={log.updated} />
                  <StatBox color="text-foreground-500" label="Omitidas" value={log.skipped} />
                  <StatBox color="text-warning" label="Excluidas" value={log.excluded} />
                </div>

                {/* Change Details */}
                {hasChanges && log.changeDetails && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground text-sm">Detalle de cambios</h3>
                    <div className="max-h-60 space-y-4 overflow-y-auto rounded-xl bg-default-100/50 p-4 text-xs">
                      {log.changeDetails.inserted && log.changeDetails.inserted.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium text-success">
                            Nuevos eventos ({log.changeDetails.inserted.length})
                          </h4>
                          <ul className="list-disc space-y-1 pl-4 opacity-80">
                            {log.changeDetails.inserted.map((item) => (
                              <li key={`inserted-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {log.changeDetails.updated && log.changeDetails.updated.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium text-info">
                            Actualizados ({log.changeDetails.updated.length})
                          </h4>
                          <ul className="list-disc space-y-1 pl-4 opacity-80">
                            {log.changeDetails.updated.map((item) => {
                              const summary = typeof item === "string" ? item : item.summary;
                              return <li key={`updated-${summary}`}>{summary}</li>;
                            })}
                          </ul>
                        </div>
                      )}

                      {log.changeDetails.excluded && log.changeDetails.excluded.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium text-warning">
                            Excluidos ({log.changeDetails.excluded.length})
                          </h4>
                          <ul className="list-disc space-y-1 pl-4 opacity-80">
                            {log.changeDetails.excluded.map((item) => (
                              <li key={`excluded-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!hasChanges && log.status === "SUCCESS" && (
                  <div className="py-4 text-center text-foreground-500 text-sm italic">
                    No hubo cambios registrados en esta sincronización.
                  </div>
                )}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function StatBox({
  color,
  label,
  value,
}: Readonly<{ color?: string; label: string; value: number }>) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-default-200 bg-content1 p-3 text-center shadow-sm">
      <span className="mb-1 font-medium text-foreground-500 text-xs uppercase tracking-wider">
        {label}
      </span>
      <span className={cn("font-bold text-2xl", color)}>{numberFormatter.format(value)}</span>
    </div>
  );
}
