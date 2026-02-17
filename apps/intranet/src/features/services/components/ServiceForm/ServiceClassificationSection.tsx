import { z } from "zod";
import { Select, SelectItem } from "@/components/ui/Select";
import { SelectWithCreateNew } from "@/components/ui/SelectWithCreateNew";
import { GRID_2_COL_MD } from "@/lib/styles";

import type {
  ServiceObligationType,
  ServiceOwnership,
  ServiceRecurrenceType,
  ServiceType,
} from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface ServiceClassificationSectionProps {
  obligationType?: ServiceObligationType;
  obligationTypeOptions: Array<{ id: string; label: string }>;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  ownership?: ServiceOwnership;
  ownershipOptions: Array<{ id: string; label: string }>;
  recurrenceType?: ServiceRecurrenceType;
  serviceType?: ServiceType;
  serviceTypeOptions: Array<{ id: string; label: string }>;
  onCreateServiceType: (value: string) => void;
  onCreateOwnership: (value: string) => void;
  onCreateObligationType: (value: string) => void;
}

const RECURRENCE_OPTIONS: { label: string; value: ServiceRecurrenceType }[] = [
  { label: "Recurrente", value: "RECURRING" },
  { label: "Puntual", value: "ONE_OFF" },
];

export function ServiceClassificationSection({
  obligationType,
  obligationTypeOptions,
  onChange,
  ownership,
  ownershipOptions,
  recurrenceType,
  serviceType,
  serviceTypeOptions,
  onCreateServiceType,
  onCreateOwnership,
  onCreateObligationType,
}: ServiceClassificationSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <SelectWithCreateNew
        createSchema={z.string().min(1, "El tipo es obligatorio").max(50)}
        description="Ej: Negocio, Proveedor, Servicio Básico"
        label="Tipo"
        options={serviceTypeOptions}
        placeholder="Selecciona o crea un tipo"
        value={serviceType || null}
        onChange={(value) => {
          onChange("serviceType", value as ServiceType);
        }}
        onCreateNew={onCreateServiceType}
      />

      <SelectWithCreateNew
        createSchema={z.string().min(1, "La propiedad es obligatoria").max(50)}
        description="Ej: Empresa, Dueño, Mixto"
        label="Propiedad"
        options={ownershipOptions}
        placeholder="Selecciona o crea una propiedad"
        value={ownership || null}
        onChange={(value) => {
          onChange("ownership", value as ServiceOwnership);
        }}
        onCreateNew={onCreateOwnership}
      />

      <SelectWithCreateNew
        createSchema={z.string().min(1, "La obligación es obligatoria").max(50)}
        description="Ej: Servicio, Deuda, Préstamo"
        label="Naturaleza"
        options={obligationTypeOptions}
        placeholder="Selecciona o crea una obligación"
        value={obligationType || null}
        onChange={(value) => {
          onChange("obligationType", value as ServiceObligationType);
        }}
        onCreateNew={onCreateObligationType}
      />

      <Select
        label="Recurrencia"
        onChange={(key) => {
          onChange("recurrenceType", key as ServiceRecurrenceType);
        }}
        value={recurrenceType ?? "RECURRING"}
      >
        {RECURRENCE_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
    </section>
  );
}
