import type { ReactNode } from "react";

import { numberFormatter } from "@/lib/format";
import { INPUT_CURRENCY_SM } from "@/lib/styles";

interface MoneyInputProps {
  icon?: ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  disabled?: boolean;
}

/**
 * Reusable currency input component for financial forms
 */
export function MoneyInput({ icon, label, value, onChange, hint, disabled }: MoneyInputProps) {
  return (
    <div className="form-control">
      <label className="label py-1">
        <span className="label-text flex items-center gap-1.5 text-xs leading-tight font-medium sm:text-sm">
          {icon}
          {label}
        </span>
      </label>
      <label className={INPUT_CURRENCY_SM}>
        <span className="text-base-content/60 text-xs sm:text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? numberFormatter.format(Number(value)) : ""}
          onChange={(e) => {
            const raw = e.target.value.replaceAll(/[^0-9-]/g, "");
            onChange(raw);
          }}
          className="text-base-content placeholder:text-base-content/40 grow bg-transparent text-xs sm:text-sm md:text-base"
          placeholder="0"
          disabled={disabled}
        />
      </label>
      {hint && <span className="text-base-content/60 mt-1 text-xs">{hint}</span>}
    </div>
  );
}
