import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";

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
      <Input
        as="select"
        label="Modo de monto"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          onChange("amountIndexation", event.target.value as ServiceAmountIndexation);
        }}
        value={amountIndexation ?? "NONE"}
      >
        {INDEXATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        as="select"
        label="Recargo por atraso"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          onChange("lateFeeMode", event.target.value as ServiceLateFeeMode);
        }}
        value={lateFeeMode ?? "NONE"}
      >
        {LATE_FEE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
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
