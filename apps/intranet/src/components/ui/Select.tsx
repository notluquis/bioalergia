import {
  Description,
  FieldError,
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  Label,
  ListBoxItem,
  SelectIndicator,
  SelectTrigger,
  SelectValue,
} from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SelectProps<T extends object = object>
  extends Omit<HeroSelectProps<T>, "children"> {
  label?: string;
  placeholder?: string;
  description?: string;
  /**
   * Helper text - maps to description
   */
  helper?: string;
  errorMessage?: string;
  children: ReactNode;
  className?: string;
}

function SelectBase<T extends object>({
  label,
  placeholder,
  description,
  helper,
  errorMessage,
  children,
  className,
  isInvalid,
  ...props
}: SelectProps<T> & { value?: string | number; onChange?: (val: any) => void }) {
  const hasError = isInvalid || !!errorMessage;

  // Map legacy value/onChange to HeroUI selectedKey/onSelectionChange if provided
  const mappedProps: any = { ...props };
  if (props.value !== undefined) {
    mappedProps.selectedKey = props.value;
  }
  if (props.onChange) {
    mappedProps.onSelectionChange = props.onChange;
  }

  return (
    <HeroSelect
      className={cn("w-full", className)}
      isInvalid={hasError}
      placeholder={placeholder}
      {...mappedProps}
    >
      {label && (
        <Label className="text-default-600 font-semibold uppercase tracking-wider">{label}</Label>
      )}
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      {(description || helper) && <Description>{description || helper}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
      {children}
    </HeroSelect>
  );
}

export const Select = Object.assign(SelectBase, {
  Indicator: SelectIndicator,
  Item: ListBoxItem,
  Trigger: SelectTrigger,
  Value: SelectValue,
});

export const SelectItem = ListBoxItem;
