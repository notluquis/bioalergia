import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";

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
      <Input
        label="Monto base"
        min={0}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("defaultAmount", Number(event.target.value));
        }}
        required
        step="0.01"
        type="number"
        value={defaultAmount ?? 0}
      />

      <Select
        // errorMessage={errors.amountIndexation?.message} // Removed as errors is not defined
        // isInvalid={!!errors.amountIndexation} // Removed as errors is not defined
        label="Modo de cálculo"
        onChange={(val) => onChange("amountIndexation", val as ServiceAmountIndexation)}
        value={amountIndexation ? amountIndexation : "NONE"}
      >
        {INDEXATION_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
      <Select
        // errorMessage={errors.lateFeeMode?.message} // Removed as errors is not defined
        // isInvalid={!!errors.lateFeeMode} // Removed as errors is not defined
        label="Recargo por atraso"
        onChange={(val) => onChange("lateFeeMode", val as ServiceLateFeeMode)}
        value={lateFeeMode ? lateFeeMode : "NONE"}
      >
        {LATE_FEE_OPTIONS.map((option) => (
          <SelectItem key={option.value}>{option.label}</SelectItem>
        ))}
      </Select>
      {(lateFeeMode ?? "NONE") !== "NONE" && (
        <>
          <Input
            label={(lateFeeMode ?? "NONE") === "PERCENTAGE" ? "% recargo" : "Monto recargo"}
            min={0}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange("lateFeeValue", Number(event.target.value));
            }}
            step="0.01"
            type="number"
            value={lateFeeValue ?? ""}
          />

          <Input
            label="Días de gracia"
            max={31}
            min={0}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange("lateFeeGraceDays", event.target.value ? Number(event.target.value) : null);
            }}
            type="number"
            value={lateFeeGraceDays ?? ""}
          />
        </>
      )}
    </section>
  );
}
