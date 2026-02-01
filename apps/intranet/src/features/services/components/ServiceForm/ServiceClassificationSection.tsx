import { Select, SelectItem } from "@/components/ui/Select";
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
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  ownership?: ServiceOwnership;
  recurrenceType?: ServiceRecurrenceType;
  serviceType?: ServiceType;
}

const SERVICE_TYPE_OPTIONS: { label: string; value: ServiceType }[] = [
  { label: "Operación general", value: "BUSINESS" },
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Servicios básicos", value: "UTILITY" },
  { label: "Arriendo / leasing", value: "LEASE" },
  { label: "Software / suscripciones", value: "SOFTWARE" },
  { label: "Impuestos / contribuciones", value: "TAX" },
  { label: "Personal", value: "PERSONAL" },
  { label: "Otro", value: "OTHER" },
];

const OWNERSHIP_OPTIONS: { label: string; value: ServiceOwnership }[] = [
  { label: "Empresa", value: "COMPANY" },
  { label: "Personal del dueño", value: "OWNER" },
  { label: "Compartido", value: "MIXED" },
  { label: "Terceros", value: "THIRD_PARTY" },
];

const OBLIGATION_OPTIONS: { label: string; value: ServiceObligationType }[] = [
  { label: "Servicio / gasto", value: "SERVICE" },
  { label: "Deuda", value: "DEBT" },
  { label: "Préstamo", value: "LOAN" },
  { label: "Otro", value: "OTHER" },
];

const RECURRENCE_OPTIONS: { label: string; value: ServiceRecurrenceType }[] = [
  { label: "Recurrente", value: "RECURRING" },
  { label: "Puntual", value: "ONE_OFF" },
];

export function ServiceClassificationSection({
  obligationType,
  onChange,
  ownership,
  recurrenceType,
  serviceType,
}: ServiceClassificationSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <Select
        label="Tipo"
        onChange={(key) => {
          onChange("serviceType", key as ServiceType);
        }}
        value={serviceType ?? "BUSINESS"}
      >
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
      <Select
        label="Propiedad"
        onChange={(key) => {
          onChange("ownership", key as ServiceOwnership);
        }}
        value={ownership ?? "COMPANY"}
      >
        {OWNERSHIP_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
      <Select
        label="Naturaleza"
        onChange={(key) => {
          onChange("obligationType", key as ServiceObligationType);
        }}
        value={obligationType ?? "SERVICE"}
      >
        {OBLIGATION_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
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
