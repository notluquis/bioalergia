import { Chip, Popover } from "@heroui/react";
import { Info, X } from "lucide-react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { Icd11DetailPanel } from "./Icd11DetailPanel";

// Chip de un diagnóstico seleccionado. Para los CIE-11 (con `uri`) agrega un
// botón ⓘ que abre un popover con la definición oficial (lazy fetch al abrir).
// Los diagnósticos escritos (CUSTOM) no tienen detalle.

export function SelectedDiagnosisChip({
  diagnosis,
  onRemove,
}: {
  diagnosis: PrescriptionDiagnosis;
  onRemove: () => void;
}) {
  const hasDetail = diagnosis.source === "CIE-11" && Boolean(diagnosis.uri);

  return (
    <Chip size="sm" variant="soft">
      <Chip.Label>
        {diagnosis.code ? `${diagnosis.code} - ${diagnosis.label}` : diagnosis.label}
        {diagnosis.cie10Code ? (
          <span className="ml-1 text-default-500">· ≈CIE-10 {diagnosis.cie10Code}</span>
        ) : null}
      </Chip.Label>

      {hasDetail && diagnosis.uri ? (
        <Popover>
          <Popover.Trigger
            aria-label={`Definición de ${diagnosis.label}`}
            className="ml-1 inline-flex text-default-500 hover:text-primary"
          >
            <Info size={12} />
          </Popover.Trigger>
          <Popover.Content className="max-w-sm">
            <Popover.Dialog>
              <Popover.Heading className="font-semibold text-sm">
                {diagnosis.code ? `${diagnosis.code} · ` : ""}
                {diagnosis.label}
              </Popover.Heading>
              <div className="mt-2">
                <Icd11DetailPanel uri={diagnosis.uri} />
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      ) : null}

      <button
        aria-label={`Quitar ${diagnosis.label}`}
        className="ml-1 inline-flex text-default-500 hover:text-danger"
        onClick={onRemove}
        type="button"
      >
        <X size={12} />
      </button>
    </Chip>
  );
}
