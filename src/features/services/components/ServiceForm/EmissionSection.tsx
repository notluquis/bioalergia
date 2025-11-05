import type { ChangeEvent } from "react";
import Input from "../../../../components/Input";
import type { ServiceEmissionMode } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface EmissionSectionProps {
  emissionMode?: ServiceEmissionMode;
  emissionDay?: number | null;
  emissionStartDay?: number | null;
  emissionEndDay?: number | null;
  emissionExactDate?: string | null;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const EMISSION_MODE_OPTIONS: Array<{ value: ServiceEmissionMode; label: string }> = [
  { value: "FIXED_DAY", label: "Día específico" },
  { value: "DATE_RANGE", label: "Rango de días" },
  { value: "SPECIFIC_DATE", label: "Fecha exacta" },
];

export function EmissionSection({
  emissionMode,
  emissionDay,
  emissionStartDay,
  emissionEndDay,
  emissionExactDate,
  onChange,
}: EmissionSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Input
        label="Modo de emisión"
        type="select"
        value={emissionMode ?? "FIXED_DAY"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("emissionMode", event.target.value as ServiceEmissionMode)
        }
      >
        {EMISSION_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      {(emissionMode ?? "FIXED_DAY") === "FIXED_DAY" && (
        <Input
          label="Día emisión"
          type="number"
          value={emissionDay ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange("emissionDay", event.target.value ? Number(event.target.value) : null)
          }
          min={1}
          max={31}
        />
      )}
      {(emissionMode ?? "FIXED_DAY") === "DATE_RANGE" && (
        <>
          <Input
            label="Día inicio emisión"
            type="number"
            value={emissionStartDay ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange("emissionStartDay", event.target.value ? Number(event.target.value) : null)
            }
            min={1}
            max={31}
          />
          <Input
            label="Día término emisión"
            type="number"
            value={emissionEndDay ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange("emissionEndDay", event.target.value ? Number(event.target.value) : null)
            }
            min={1}
            max={31}
          />
        </>
      )}
      {(emissionMode ?? "FIXED_DAY") === "SPECIFIC_DATE" && (
        <Input
          label="Fecha emisión"
          type="date"
          value={emissionExactDate ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("emissionExactDate", event.target.value || null)}
        />
      )}
    </section>
  );
}
