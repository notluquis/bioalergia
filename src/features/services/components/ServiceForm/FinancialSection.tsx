import type { ChangeEvent } from "react";
import Input from "../../../../components/ui/Input";
import type { ServiceLateFeeMode, ServiceAmountIndexation } from "../../types";
import type { ServiceFormState } from "../ServiceForm";

interface FinancialSectionProps {
  defaultAmount?: number;
  amountIndexation?: string;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: number | null;
  lateFeeGraceDays?: number | null;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

const INDEXATION_OPTIONS = [
  { value: "NONE", label: "Monto fijo" },
  { value: "UF", label: "Actualiza por UF" },
];

const LATE_FEE_OPTIONS: Array<{ value: ServiceLateFeeMode; label: string }> = [
  { value: "NONE", label: "Sin recargo" },
  { value: "FIXED", label: "Monto fijo" },
  { value: "PERCENTAGE", label: "% del monto" },
];

export function FinancialSection({
  defaultAmount,
  amountIndexation,
  lateFeeMode,
  lateFeeValue,
  lateFeeGraceDays,
  onChange,
}: FinancialSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Input
        label="Monto base"
        type="number"
        value={defaultAmount ?? 0}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("defaultAmount", Number(event.target.value))}
        min={0}
        step="0.01"
        required
      />
      <Input
        label="Modo de monto"
        as="select"
        value={amountIndexation ?? "NONE"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("amountIndexation", event.target.value as ServiceAmountIndexation)
        }
      >
        {INDEXATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Input>
      <Input
        label="Recargo por atraso"
        as="select"
        value={lateFeeMode ?? "NONE"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("lateFeeMode", event.target.value as ServiceLateFeeMode)
        }
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
            type="number"
            value={lateFeeValue ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("lateFeeValue", Number(event.target.value))}
            min={0}
            step="0.01"
          />
          <Input
            label="Días de gracia"
            type="number"
            value={lateFeeGraceDays ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange("lateFeeGraceDays", event.target.value ? Number(event.target.value) : null)
            }
            min={0}
            max={31}
          />
        </>
      )}
    </section>
  );
}
