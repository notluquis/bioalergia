import type { ChangeEvent } from "react";
import Input from "../../../../components/ui/Input";
import type { ServiceType, ServiceOwnership, ServiceObligationType, ServiceRecurrenceType } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface ServiceClassificationSectionProps {
  serviceType?: ServiceType;
  ownership?: ServiceOwnership;
  obligationType?: ServiceObligationType;
  recurrenceType?: ServiceRecurrenceType;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceType; label: string }> = [
  { value: "BUSINESS", label: "Operación general" },
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "UTILITY", label: "Servicios básicos" },
  { value: "LEASE", label: "Arriendo / leasing" },
  { value: "SOFTWARE", label: "Software / suscripciones" },
  { value: "TAX", label: "Impuestos / contribuciones" },
  { value: "PERSONAL", label: "Personal" },
  { value: "OTHER", label: "Otro" },
];

const OWNERSHIP_OPTIONS: Array<{ value: ServiceOwnership; label: string }> = [
  { value: "COMPANY", label: "Empresa" },
  { value: "OWNER", label: "Personal del dueño" },
  { value: "MIXED", label: "Compartido" },
  { value: "THIRD_PARTY", label: "Terceros" },
];

const OBLIGATION_OPTIONS: Array<{ value: ServiceObligationType; label: string }> = [
  { value: "SERVICE", label: "Servicio / gasto" },
  { value: "DEBT", label: "Deuda" },
  { value: "LOAN", label: "Préstamo" },
  { value: "OTHER", label: "Otro" },
];

const RECURRENCE_OPTIONS: Array<{ value: ServiceRecurrenceType; label: string }> = [
  { value: "RECURRING", label: "Recurrente" },
  { value: "ONE_OFF", label: "Puntual" },
];

export function ServiceClassificationSection({
  serviceType,
  ownership,
  obligationType,
  recurrenceType,
  onChange,
}: ServiceClassificationSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Input
        label="Tipo"
        as="select"
        value={serviceType ?? "BUSINESS"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange("serviceType", event.target.value as ServiceType)}
      >
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        label="Propiedad"
        as="select"
        value={ownership ?? "COMPANY"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("ownership", event.target.value as ServiceOwnership)
        }
      >
        {OWNERSHIP_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        label="Naturaleza"
        as="select"
        value={obligationType ?? "SERVICE"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("obligationType", event.target.value as ServiceObligationType)
        }
      >
        {OBLIGATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        label="Recurrencia"
        as="select"
        value={recurrenceType ?? "RECURRING"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("recurrenceType", event.target.value as ServiceRecurrenceType)
        }
      >
        {RECURRENCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
    </section>
  );
}
