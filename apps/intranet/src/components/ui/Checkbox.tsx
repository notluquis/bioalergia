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

export default function Checkbox({
  className,
  label,
  checked,
  onChange,
  onCheckedChange,
  value,
  ...props
}: Readonly<CheckboxProps>) {
  return (
    // @ts-expect-error - HeroUI v3 beta typing mismatch with InputHTMLAttributes
    <HeroCheckbox
      className={cn("gap-3", className)}
      isSelected={checked}
      value={value as string}
      onChange={(isSelected: boolean) => {
        // Support both onCheckedChange (Shadcn-like) and onChange (Native-like)
        onCheckedChange?.(isSelected);

        // Mock native event for onChange if provided
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
      }}
      {...props}
    >
      {label}
    </HeroCheckbox>
  );
}
