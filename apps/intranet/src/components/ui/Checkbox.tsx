/**
 * Checkbox Component - Adapter for HeroUI Checkbox
 */
import { Checkbox as HeroCheckbox } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<ComponentProps<typeof HeroCheckbox>, "children" | "isSelected" | "onChange"> {
  checked?: boolean;
  label?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}
export function Checkbox({
  className,
  label,
  checked,
  onCheckedChange,
  ...props
}: Readonly<CheckboxProps>) {
  return (
    <HeroCheckbox
      className={cn("gap-3", className)}
      isSelected={checked}
      onChange={onCheckedChange}
      {...props}
    >
      <HeroCheckbox.Control>
        <HeroCheckbox.Indicator />
      </HeroCheckbox.Control>
      {label ? <HeroCheckbox.Content>{label}</HeroCheckbox.Content> : null}
    </HeroCheckbox>
  );
}
