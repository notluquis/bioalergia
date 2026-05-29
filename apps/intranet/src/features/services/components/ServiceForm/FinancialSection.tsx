import { Label, ListBox, NumberField, Select } from "@heroui/react";

import type { ServiceAmountIndexation, ServiceLateFeeMode } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

// Services operate in CLP (no per-service currency field) → amounts have no
// decimals. Mirror lib/utils.ts::formatCurrency for CLP.
const CLP_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "CLP",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

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
  const isPercentage = (lateFeeMode ?? "NONE") === "PERCENTAGE";

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <NumberField
        formatOptions={CLP_FORMAT_OPTIONS}
        isRequired
        minValue={0}
        onChange={(value) => {
          onChange("defaultAmount", value ?? 0);
        }}
        value={defaultAmount ?? 0}
      >
        <Label>Monto base</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>

      <Select
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
          <NumberField
            formatOptions={isPercentage ? undefined : CLP_FORMAT_OPTIONS}
            minValue={0}
            onChange={(value) => {
              onChange("lateFeeValue", value ?? null);
            }}
            value={lateFeeValue == null ? Number.NaN : lateFeeValue}
          >
            {/* Stored percentage is a whole number (e.g. 5 = 5%), not a 0–1
                fraction, so use decimal + a "%" label instead of style:"percent". */}
            <Label>{isPercentage ? "% recargo" : "Monto recargo"}</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <NumberField
            maxValue={31}
            minValue={0}
            onChange={(value) => {
              onChange("lateFeeGraceDays", Number.isNaN(value) ? null : (value ?? null));
            }}
            value={lateFeeGraceDays == null ? Number.NaN : lateFeeGraceDays}
          >
            <Label>Días de gracia</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
        </>
      )}
    </section>
  );
}
