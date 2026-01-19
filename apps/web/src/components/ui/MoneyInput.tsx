import type { ReactNode } from "react";

import { numberFormatter } from "@/lib/format";
import { INPUT_CURRENCY_SM } from "@/lib/styles";

interface MoneyInputProps {
  disabled?: boolean;
  hint?: string;
  icon?: ReactNode;
  label: string;
  onChange: (next: string) => void;
  value: string;
}

/**
 * Reusable currency input component for financial forms
 */
export function MoneyInput({
  disabled,
  hint,
  icon,
  label,
  onChange,
  value,
}: Readonly<MoneyInputProps>) {
  return (
    <div className="form-control">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: legacy component */}
      <label className="label py-1">
        <span className="label-text flex items-center gap-1.5 text-xs leading-tight font-medium sm:text-sm">
          {icon}
          {label}
        </span>
      </label>
      <label className={INPUT_CURRENCY_SM}>
        <span className="text-base-content/60 text-xs sm:text-sm">$</span>
        <input
          className="text-base-content placeholder:text-base-content/40 grow bg-transparent text-xs sm:text-sm md:text-base"
          disabled={disabled}
          inputMode="numeric"
          onChange={(e) => {
            const raw = e.target.value.replaceAll(/[^0-9-]/g, "");
            onChange(raw);
          }}
          placeholder="0"
          type="text"
          value={value ? numberFormatter.format(Number(value)) : ""}
        />
      </label>
      {hint && <span className="text-base-content/60 mt-1 text-xs">{hint}</span>}
    </div>
  );
}
