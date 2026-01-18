import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";

import type { ServiceEmissionMode } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface EmissionSectionProps {
  emissionDay?: null | number;
  emissionEndDay?: null | number;
  emissionExactDate?: null | string;
  emissionMode?: ServiceEmissionMode;
  emissionStartDay?: null | number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const EMISSION_MODE_OPTIONS: { label: string; value: ServiceEmissionMode }[] = [
  { label: "Día específico", value: "FIXED_DAY" },
  { label: "Rango de días", value: "DATE_RANGE" },
  { label: "Fecha exacta", value: "SPECIFIC_DATE" },
];

export function EmissionSection({
  emissionDay,
  emissionEndDay,
  emissionExactDate,
  emissionMode,
  emissionStartDay,
  onChange,
}: EmissionSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Input
        as="select"
        label="Modo de emisión"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          onChange("emissionMode", event.target.value as ServiceEmissionMode);
        }}
        value={emissionMode ?? "FIXED_DAY"}
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
          max={31}
          min={1}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange("emissionDay", event.target.value ? Number(event.target.value) : null);
          }}
          type="number"
          value={emissionDay ?? ""}
        />
      )}
      {(emissionMode ?? "FIXED_DAY") === "DATE_RANGE" && (
        <>
          <Input
            label="Día inicio emisión"
            max={31}
            min={1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange("emissionStartDay", event.target.value ? Number(event.target.value) : null);
            }}
            type="number"
            value={emissionStartDay ?? ""}
          />
          <Input
            label="Día término emisión"
            max={31}
            min={1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange("emissionEndDay", event.target.value ? Number(event.target.value) : null);
            }}
            type="number"
            value={emissionEndDay ?? ""}
          />
        </>
      )}
      {(emissionMode ?? "FIXED_DAY") === "SPECIFIC_DATE" && (
        <Input
          label="Fecha emisión"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange("emissionExactDate", event.target.value || null);
          }}
          type="date"
          value={emissionExactDate ?? ""}
        />
      )}
    </section>
  );
}
