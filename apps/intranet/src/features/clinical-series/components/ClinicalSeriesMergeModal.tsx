/**
 * ClinicalSeriesMergeModal
 * Confirms merging a duplicate pair (source → target).
 * Shows both series side-by-side; user can swap direction before confirming.
 */

import { Alert, Button, Modal, Spinner, Surface } from "@heroui/react";
import { useState } from "react";
import { useMergeClinicalSeries } from "../queries";
import type { ClinicalSeriesDuplicate, ClinicalSeriesSnapshot } from "../types";

const KIND_LABELS: Record<string, string> = {
  PATCH_TEST: "Prueba de parche",
  SKIN_TEST: "Test alérgico",
  SUBCUTANEOUS_TREATMENT: "Tratamiento subcutáneo",
};

function SeriesCard({ label, snapshot }: { label: string; snapshot: ClinicalSeriesSnapshot }) {
  const eventCount = snapshot.events.length;
  const dates = snapshot.events.map((e) => e.eventDate).sort();
  const dateRange =
    dates.length > 0
      ? dates.length === 1
        ? dates[0]!
        : `${dates[0]!} → ${dates[dates.length - 1]!}`
      : "Sin eventos";

  return (
    <Surface className="rounded-xl p-3 flex-1 min-w-0 space-y-1">
      <p className="text-[11px] text-foreground-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="font-medium text-sm truncate">{snapshot.patientName ?? "Sin nombre"}</p>
      {snapshot.patientRut && (
        <p className="font-mono text-xs text-foreground-400">{snapshot.patientRut}</p>
      )}
      <p className="text-xs text-foreground-400">{KIND_LABELS[snapshot.kind] ?? snapshot.kind}</p>
      <p className="text-xs text-foreground-300">
        {eventCount} evento{eventCount !== 1 ? "s" : ""} · {dateRange}
      </p>
    </Surface>
  );
}

export interface ClinicalSeriesMergeModalProps {
  duplicate: ClinicalSeriesDuplicate;
  isOpen: boolean;
  onClose: () => void;
  /** Snapshots for the two series — preloaded by the caller */
  snapshots: Record<number, ClinicalSeriesSnapshot>;
}

export function ClinicalSeriesMergeModal({
  duplicate,
  isOpen,
  onClose,
  snapshots,
}: ClinicalSeriesMergeModalProps) {
  const [swapped, setSwapped] = useState(false);
  const merge = useMergeClinicalSeries();

  const sourceId = swapped ? duplicate.targetId : duplicate.sourceId;
  const targetId = swapped ? duplicate.sourceId : duplicate.targetId;

  const sourceSnap = snapshots[sourceId];
  const targetSnap = snapshots[targetId];

  const handleConfirm = async () => {
    await merge.mutateAsync({
      mergeReason: duplicate.reason,
      sourceId,
      targetId,
    });
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-lg rounded-[24px] bg-background p-6 shadow-2xl space-y-4">
            <Modal.Header>
              <Modal.Heading className="font-bold text-lg">
                Fusionar series duplicadas
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-4">
              <p className="text-sm text-foreground-400">
                Se elimina la serie fuente y todos sus eventos se mueven a la serie destino.
              </p>

              {merge.isError && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {merge.error instanceof Error ? merge.error.message : "Error al fusionar"}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <div className="flex gap-2 items-stretch">
                {sourceSnap && <SeriesCard label="Eliminar (fuente)" snapshot={sourceSnap} />}
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  <span className="text-foreground-300 text-lg">→</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => setSwapped((s) => !s)}
                    className="text-xs text-foreground-400 h-auto py-1 px-2"
                    isDisabled={merge.isPending}
                  >
                    Invertir
                  </Button>
                </div>
                {targetSnap && <SeriesCard label="Conservar (destino)" snapshot={targetSnap} />}
              </div>

              <p className="text-xs text-foreground-300 italic">{duplicate.reason}</p>
            </Modal.Body>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onPress={onClose} isDisabled={merge.isPending}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="bg-danger text-danger-foreground"
                onPress={() => void handleConfirm()}
                isDisabled={merge.isPending || !sourceSnap || !targetSnap}
              >
                {merge.isPending ? <Spinner size="sm" /> : "Fusionar"}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
