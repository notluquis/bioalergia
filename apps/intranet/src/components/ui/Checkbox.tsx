/**
 * Checkbox Component - Adapter for HeroUI Checkbox
 */
import { Checkbox as HeroCheckbox } from "@heroui/react";
import type React from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}
export function Checkbox({
  className,
  label,
  checked,
  onChange,
  onCheckedChange,
  value,
  ...props
}: Readonly<CheckboxProps>) {
  const handleChange = (isSelected: boolean) => {
    onCheckedChange?.(isSelected);

    if (onChange) {
      const event = {
        target: {
          checked: isSelected,
          type: "checkbox",
        },
        type: "change",
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  return (
    // @ts-expect-error - HeroUI v3 beta typing mismatch with InputHTMLAttributes
    <HeroCheckbox
      className={cn("gap-3", className)}
      isSelected={checked}
      value={value as string}
      onChange={handleChange}
      {...props}
    >
      <HeroCheckbox.Control>
        <HeroCheckbox.Indicator />
      </HeroCheckbox.Control>
      {label ? <HeroCheckbox.Content>{label}</HeroCheckbox.Content> : null}
    </HeroCheckbox>
  );
}
