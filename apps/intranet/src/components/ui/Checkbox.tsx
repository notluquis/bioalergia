/**
 * Checkbox Component - Adapter for HeroUI Checkbox
 */
import { Checkbox as HeroCheckbox, Label } from "@heroui/react";
import { type ComponentProps, type ReactNode, useId } from "react";

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
  const generatedId = useId();
  const checkboxId = props.id ?? generatedId;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <HeroCheckbox id={checkboxId} isSelected={checked} onChange={onCheckedChange} {...props}>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
      </HeroCheckbox>
      {label ? <Label htmlFor={checkboxId}>{label}</Label> : null}
    </div>
  );
}
