import { FieldError, Label, ListBox, Select } from "@heroui/react";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/Input";

import type { ServiceEmissionMode } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface EmissionSectionProps {
  emissionDay?: null | number;
  emissionEndDay?: null | number;
  emissionExactDate?: null | Date;
  emissionMode?: ServiceEmissionMode;
  emissionStartDay?: null | number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  // Assuming errors and value are passed as props based on the example
  errors: {
    emissionMode?: { message?: string };
    emissionDay?: { message?: string };
    emissionStartDay?: { message?: string };
    emissionEndDay?: { message?: string };
    emissionExactDate?: { message?: string };
  };
}

// EMISSION_MODE_OPTIONS is no longer used for rendering the Select options directly
// const EMISSION_MODE_OPTIONS: { label: string; value: ServiceEmissionMode }[] = [
//   { label: "Día específico", value: "FIXED_DAY" },
//   { label: "Rango de días", value: "DATE_RANGE" },
//   { label: "Fecha exacta", value: "SPECIFIC_DATE" },
// ];

export function EmissionSection({
  emissionDay,
  emissionEndDay,
  emissionExactDate,
  emissionMode,
  emissionStartDay,
  onChange,
  errors, // Added based on example
}: EmissionSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Select
        isInvalid={Boolean(errors.emissionMode)}
        onChange={(val) => onChange("emissionMode", val as ServiceEmissionMode)}
        value={emissionMode}
      >
        <Label>Modalidad de emisión</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="SPECIFIC_DATE">Fecha Específica</ListBox.Item>
            <ListBox.Item id="DATE_RANGE">Rango de Fechas</ListBox.Item>
            <ListBox.Item id="FIXED_DAY">Día Fijo del Mes</ListBox.Item>
            <ListBox.Item id="NONE">No Aplica / Desconocido</ListBox.Item>
          </ListBox>
        </Select.Popover>
        {errors.emissionMode?.message && <FieldError>{errors.emissionMode.message}</FieldError>}
      </Select>
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
            onChange(
              "emissionExactDate",
              event.target.value ? dayjs(event.target.value).toDate() : null,
            );
          }}
          type="date"
          value={emissionExactDate ? dayjs(emissionExactDate).format("YYYY-MM-DD") : ""}
        />
      )}
    </section>
  );
}
