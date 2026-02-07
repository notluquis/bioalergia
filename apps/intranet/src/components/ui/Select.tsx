import {
  Description,
  FieldError,
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  Label,
  ListBox,
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
}: SelectProps<T> & {
  value?: HeroSelectProps<T>["selectedKey"];
  onChange?: HeroSelectProps<T>["onSelectionChange"];
}) {
  const hasError = isInvalid || Boolean(errorMessage);

  // Map legacy value/onChange to HeroUI selectedKey/onSelectionChange if provided
  const { value, onChange, ...restProps } = props;
  const mappedProps: HeroSelectProps<T> = { ...restProps };
  if (value !== undefined && value !== "") {
    mappedProps.selectedKey = value;
  } else if (value === "" || value === undefined) {
    // For empty or undefined values, pass null to selectedKey to show placeholder
    mappedProps.selectedKey = null;
  }
  if (onChange) {
    mappedProps.onSelectionChange = onChange;
  }

  return (
    <HeroSelect
      className={cn("w-full", className)}
      isInvalid={hasError}
      placeholder={placeholder}
      {...mappedProps}
    >
      {label && (
        <Label className="font-semibold text-default-600 uppercase tracking-wider">{label}</Label>
      )}
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      {(description || helper) && <Description>{description || helper}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
      <HeroSelect.Popover>
        <ListBox>{children}</ListBox>
      </HeroSelect.Popover>
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
