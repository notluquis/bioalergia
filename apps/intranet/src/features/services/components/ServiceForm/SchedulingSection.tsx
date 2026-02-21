import { Label, ListBox, Select } from "@heroui/react";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/Input";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { ServiceFrequency, ServiceRecurrenceType } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface SchedulingSectionProps {
  dueDay?: null | number;
  effectiveMonths: number;
  frequency?: ServiceFrequency;
  monthsToGenerate?: number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  recurrenceType?: ServiceRecurrenceType;
  startDate?: Date;
}

const FREQUENCY_OPTIONS: { label: string; value: ServiceFrequency }[] = [
  { label: "Semanal", value: "WEEKLY" },
  { label: "Quincenal", value: "BIWEEKLY" },
  { label: "Mensual", value: "MONTHLY" },
  { label: "Bimensual", value: "BIMONTHLY" },
  { label: "Trimestral", value: "QUARTERLY" },
  { label: "Semestral", value: "SEMIANNUAL" },
  { label: "Anual", value: "ANNUAL" },
  { label: "Única vez", value: "ONCE" },
];

export function SchedulingSection({
  dueDay,
  effectiveMonths,
  frequency,
  onChange,
  recurrenceType,
  startDate,
}: SchedulingSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <Select
        onChange={(key) => {
          onChange("frequency", key as ServiceFrequency);
        }}
        value={frequency ?? "MONTHLY"}
      >
        <Label>Frecuencia</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {FREQUENCY_OPTIONS.map((option) => (
              <ListBox.Item id={option.value} key={option.value}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Input
        label="Fecha de inicio"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("startDate", dayjs(event.target.value).toDate());
        }}
        required
        type="date"
        value={startDate ? dayjs(startDate).format("YYYY-MM-DD") : ""}
      />

      <Input
        disabled={recurrenceType === "ONE_OFF" || frequency === "ONCE"}
        helper={
          recurrenceType === "ONE_OFF" || frequency === "ONCE"
            ? "Para servicios puntuales se genera un único periodo"
            : undefined
        }
        label="Meses a generar"
        max={60}
        min={1}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("monthsToGenerate", Number(event.target.value));
        }}
        type="number"
        value={effectiveMonths}
      />

      <Input
        label="Día de vencimiento"
        max={31}
        min={1}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("dueDay", event.target.value ? Number(event.target.value) : null);
        }}
        type="number"
        value={dueDay ?? ""}
      />
    </section>
  );
}
