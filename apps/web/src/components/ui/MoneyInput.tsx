import { Description, Label, NumberField } from "@heroui/react";
import type { ReactNode } from "react";

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
 * Wraps HeroUI NumberField for standardized currency handling
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
    <NumberField
      className="w-full"
      formatOptions={{
        style: "currency",
        currency: "CLP",
        currencyDisplay: "symbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }}
      isDisabled={disabled}
      onChange={(val) => {
        if (val === undefined || Number.isNaN(val)) {
          onChange("");
        } else {
          onChange(val.toString());
        }
      }}
      value={value && !Number.isNaN(Number(value)) ? Number(value) : undefined}
    >
      <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
        {icon}
        {label}
      </Label>
      <NumberField.Group>
        <NumberField.Input />
      </NumberField.Group>
      {hint && <Description className="text-xs">{hint}</Description>}
    </NumberField>
  );
}
