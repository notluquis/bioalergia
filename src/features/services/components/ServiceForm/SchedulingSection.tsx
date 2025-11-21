import type { ChangeEvent } from "react";
import Input from "../../../../components/ui/Input";
import type { ServiceFrequency, ServiceRecurrenceType } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface SchedulingSectionProps {
  frequency?: ServiceFrequency;
  startDate?: string;
  monthsToGenerate?: number;
  dueDay?: number | null;
  recurrenceType?: ServiceRecurrenceType;
  effectiveMonths: number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const FREQUENCY_OPTIONS: Array<{ value: ServiceFrequency; label: string }> = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIMONTHLY", label: "Bimensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "ONCE", label: "Única vez" },
];

export function SchedulingSection({
  frequency,
  startDate,
  dueDay,
  recurrenceType,
  effectiveMonths,
  onChange,
}: SchedulingSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Input
        label="Frecuencia"
        as="select"
        value={frequency ?? "MONTHLY"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("frequency", event.target.value as ServiceFrequency)
        }
      >
        {FREQUENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        label="Fecha de inicio"
        type="date"
        value={startDate ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("startDate", event.target.value)}
        required
      />
      <Input
        label="Meses a generar"
        type="number"
        value={effectiveMonths}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("monthsToGenerate", Number(event.target.value))}
        min={1}
        max={60}
        disabled={recurrenceType === "ONE_OFF" || frequency === "ONCE"}
        helper={
          recurrenceType === "ONE_OFF" || frequency === "ONCE"
            ? "Para servicios puntuales se genera un único periodo"
            : undefined
        }
      />
      <Input
        label="Día de vencimiento"
        type="number"
        value={dueDay ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange("dueDay", event.target.value ? Number(event.target.value) : null)
        }
        min={1}
        max={31}
      />
    </section>
  );
}
