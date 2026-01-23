import { Description, FieldError, Label, NumberField } from "@heroui/react";
import type { ReactNode } from "react";

interface MoneyInputProps {
  disabled?: boolean;
  hint?: string;
  icon?: ReactNode;
  label: string;
  onValueChange: (next: number | null) => void;
  value: number | string;
  error?: string;
  className?: string;
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
  onValueChange,
  value,
  error,
  className,
}: Readonly<MoneyInputProps>) {
  // Handle string value from legacy usage if necessary
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;

  return (
    <NumberField
      className={className || "w-full"}
      formatOptions={{
        style: "currency",
        currency: "CLP",
        currencyDisplay: "symbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }}
      isDisabled={disabled}
      isInvalid={!!error}
      onChange={(val) => {
        onValueChange(val ?? null);
      }}
      value={numericValue ?? undefined}
    >
      <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
        {icon}
        {label}
      </Label>
      <NumberField.Group>
        <NumberField.Input />
      </NumberField.Group>
      {(error || hint) && (
        <Description className="text-xs">
          {error ? <FieldError className="text-danger">{error}</FieldError> : hint}
        </Description>
      )}
    </NumberField>
  );
}
