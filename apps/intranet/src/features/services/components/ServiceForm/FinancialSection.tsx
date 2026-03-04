import { Input, Label, ListBox, Select, TextField } from "@heroui/react";
import type { ChangeEvent } from "react";

import type { ServiceAmountIndexation, ServiceLateFeeMode } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface FinancialSectionProps {
  amountIndexation?: string;
  defaultAmount?: number;
  lateFeeGraceDays?: null | number;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: null | number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const INDEXATION_OPTIONS = [
  { label: "Monto fijo", value: "NONE" },
  { label: "Actualiza por UF", value: "UF" },
];

const LATE_FEE_OPTIONS: { label: string; value: ServiceLateFeeMode }[] = [
  { label: "Sin recargo", value: "NONE" },
  { label: "Monto fijo", value: "FIXED" },
  { label: "% del monto", value: "PERCENTAGE" },
];

export function FinancialSection({
  amountIndexation,
  defaultAmount,
  lateFeeGraceDays,
  lateFeeMode,
  lateFeeValue,
  onChange,
}: FinancialSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <TextField isRequired type="number">
        <Label>Monto base</Label>
        <Input
          min={0}
          step="0.01"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange("defaultAmount", Number(event.target.value));
          }}
          value={String(defaultAmount ?? 0)}
        />
      </TextField>

      <Select
        // errorMessage={errors.amountIndexation?.message} // Removed as errors is not defined
        // isInvalid={!!errors.amountIndexation} // Removed as errors is not defined
        onChange={(val) => onChange("amountIndexation", val as ServiceAmountIndexation)}
        value={amountIndexation ? amountIndexation : "NONE"}
      >
        <Label>Modo de cálculo</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {INDEXATION_OPTIONS.map((option) => (
              <ListBox.Item id={option.value} key={option.value}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Select
        // errorMessage={errors.lateFeeMode?.message} // Removed as errors is not defined
        // isInvalid={!!errors.lateFeeMode} // Removed as errors is not defined
        onChange={(val) => onChange("lateFeeMode", val as ServiceLateFeeMode)}
        value={lateFeeMode ? lateFeeMode : "NONE"}
      >
        <Label>Recargo por atraso</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {LATE_FEE_OPTIONS.map((option) => (
              <ListBox.Item id={option.value} key={option.value}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {(lateFeeMode ?? "NONE") !== "NONE" && (
        <>
          <TextField type="number">
            <Label>
              {(lateFeeMode ?? "NONE") === "PERCENTAGE" ? "% recargo" : "Monto recargo"}
            </Label>
            <Input
              min={0}
              step="0.01"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onChange("lateFeeValue", Number(event.target.value));
              }}
              value={lateFeeValue == null ? "" : String(lateFeeValue)}
            />
          </TextField>

          <TextField type="number">
            <Label>Días de gracia</Label>
            <Input
              max={31}
              min={0}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onChange(
                  "lateFeeGraceDays",
                  event.target.value ? Number(event.target.value) : null,
                );
              }}
              value={lateFeeGraceDays == null ? "" : String(lateFeeGraceDays)}
            />
          </TextField>
        </>
      )}
    </section>
  );
}
